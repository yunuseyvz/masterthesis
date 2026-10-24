import { randomInt } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import Fastify from "fastify";
import fastifyHttpProxy from "@fastify/http-proxy";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { generateSessionPlan } from "@beacon/shared";
import { FakeAgentHost, OpencodeHost, type AgentHost } from "./agent.js";
import { makeStoryLoader } from "./trial.js";
import { makeEventSink, writeBundle } from "./export.js";
import { ConflictError, StudySession } from "./machine.js";
import { ReplayEndpoint } from "./replay.js";
import { assertUnreadable, killUserProcesses, type SandboxOptions } from "./sandbox.js";

export interface ServerConfig {
  participantId: string;
  studySeed: string;
  group?: number;
  exportDir: string;
  /** Trial definitions (study-harness/trials): which capture, its steps and variants, and the questions. */
  trialsDir: string;
  /** Captures made by the capture tool (captures/). */
  capturesDir: string;
  staticDir?: string;
  exitOnFinish: boolean;
  /** Demo deployment: after Finish, start a fresh session (new ID, seed and next group) instead of stopping. */
  demo?: boolean;
  /** Screen recording of the agent UI with rrweb, written to <participant>_<seed>.recording.jsonl. */
  recording?: boolean;
  /** Experimenter aid: show the regime/variant tag in the UI. Never enable for real participants. */
  showCondition?: boolean;
  sandbox: SandboxOptions;
  /** Paths the sandbox uid must not be able to read (checked at startup). */
  protectedPaths?: string[];
  /** Root for the per-trial project folders the agent works in. */
  workRoot: string;
  /** Replay speed: 0 answers instantly, 1 paces the agent like a real model (streamed text, time for file writes). */
  replayPace?: number;
  /** "opencode" runs the real agent; "fake" plays the replay without a UI (tests, development). */
  agent:
    | { kind: "fake" }
    | { kind: "opencode"; bin: string; port: number; replayPort: number; home: string };
}

/**
 * opencode API calls the participant's browser may not make: everything that would change the recorded session
 * (prompting the agent, switching agents, reverting, forking, compacting, deleting or creating sessions). The study
 * server drives the agent itself, directly and not through this proxy.
 */
const BLOCKED: [string, RegExp][] = [
  ["POST", /^\/api\/session\/?(\?|$)/],
  ["DELETE", /^\/api\/session\/[^/]+\/?(\?|$)/],
  ["POST", /^\/api\/session\/[^/]+\/(prompt|command|shell|synthetic|agent|fork|compact|revert\/.*|generate)(\?|$)/],
  ["DELETE", /^\/api\/session\/[^/]+\/revert(\?|$)/],
  ["POST", /^\/api\/session\/[^/]+\/(archive|share)/],
];
export const isBlocked = (method: string, url: string) => BLOCKED.some(([m, re]) => m === method && re.test(url));

export async function buildApp(cfg: ServerConfig) {
  assertUnreadable(cfg.protectedPaths ?? [], cfg.sandbox);
  const loadStory = makeStoryLoader(cfg.trialsDir, cfg.capturesDir);

  let session!: StudySession;
  let recordingFile = "";
  // Events from the agent and the replay belong to whichever session is current.
  const log = (type: string, data: unknown) => session?.log(type, data);
  const replay = new ReplayEndpoint(log, cfg.replayPace ?? 0);
  let agent: AgentHost;
  if (cfg.agent.kind === "opencode") {
    await replay.listen(cfg.agent.replayPort);
    agent = await new OpencodeHost({
      bin: cfg.agent.bin,
      port: cfg.agent.port,
      replayUrl: `http://127.0.0.1:${cfg.agent.replayPort}/v1`,
      home: cfg.agent.home,
      sandbox: cfg.sandbox,
      log,
    }).start();
  } else {
    agent = new FakeAgentHost(replay);
  }

  const start = (participantId: string, studySeed: string, group?: number) => {
    const plan = generateSessionPlan({ participantId, studySeed, group });
    const sink = makeEventSink(cfg.exportDir, participantId, studySeed);
    session = new StudySession(plan, loadStory, { agent, replay, workRoot: path.join(cfg.workRoot, participantId), sandbox: cfg.sandbox }, sink, Date.now, cfg.showCondition ?? false);
    recordingFile = path.join(cfg.exportDir, `${participantId}_${studySeed}.recording.jsonl`);
    return plan;
  };
  let group = start(cfg.participantId, cfg.studySeed, cfg.group).group;

  const app = Fastify({ logger: false });
  app.addHook("onClose", async () => {
    agent.close();
    replay.close();
  });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: err.issues });
    app.log.error(err);
    session?.log("server_error", { message: String(err) });
    return reply.code(500).send({ error: "internal error" });
  });

  const decorate = <T extends object>(v: T) => ({ ...v, ...(cfg.demo ? { demo: true } : {}), ...(cfg.recording ? { recording: true } : {}) });
  // The study's own API. Everything else on this origin is opencode: its web app (study build, agent-ui/) and,
  // forwarded below, its API. One origin means the browser never talks to opencode directly or sees its password.
  app.get("/_study/state", async () => decorate(session.view()));
  app.post("/_study/action", async (req) => decorate(await session.act(req.body)));
  /** Participant activity inside opencode (study build of its web app): clicks, changes view, terminal commands. */
  app.post("/_study/event", async (req) => {
    session.recordUi(req.body);
    return { ok: true };
  });
  if (cfg.recording) {
    // rrweb's browser build, loaded by the agent UI only when recording is on.
    const rrweb = path.join(path.dirname(createRequire(import.meta.url).resolve("rrweb")), "rrweb.umd.min.cjs");
    app.get("/_study/rrweb.js", async (_req, reply) => reply.type("application/javascript").send(fs.readFileSync(rrweb)));
    /** Batches of rrweb events, one JSON line each with the study phase and trial they were sent in. */
    app.post("/_study/recording", { bodyLimit: 32 * 1024 * 1024 }, async (req) => {
      const { events } = req.body as { events: unknown[] };
      if (!Array.isArray(events)) return { ok: false };
      const v = session.view();
      const lines = events.map((e) => JSON.stringify({ phase: v.phase, trial: v.trial, e })).join("\n");
      fs.mkdirSync(cfg.exportDir, { recursive: true });
      const fd = fs.openSync(recordingFile, "a");
      fs.writeSync(fd, lines + "\n");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      return { ok: true };
    });
  }
  app.post("/_study/finish", async (_req, reply) => {
    const bundle = session.finish();
    writeBundle(cfg.exportDir, bundle);
    // The participant's terminal and anything they started in it run as the sandbox user.
    if (cfg.sandbox.uid !== undefined && !cfg.demo) killUserProcesses(cfg.sandbox.uid);
    if (cfg.demo) {
      // Same ID format as study-harness/scripts/run-session.sh; the next group keeps a run of demos balanced too.
      const id = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("");
      group = start(id, String(randomInt(2 ** 32)), (group + 1) % 6).group;
    }
    await reply.send({ ok: true, restarted: cfg.demo === true });
    if (cfg.exitOnFinish && !cfg.demo) setImmediate(() => process.exit(0));
    return reply;
  });

  const target = agent.proxy();
  if (target) {
    // opencode checks Origin against Host for the terminal; the proxy changes Host, so Origin must match it.
    const auth = (headers: Record<string, unknown>) => ({ ...headers, authorization: target.authorization, ...(headers.origin ? { origin: target.url } : {}) });
    for (const prefix of ["/api", "/auth"]) {
      app.register(fastifyHttpProxy, {
        upstream: target.url,
        prefix,
        rewritePrefix: prefix,
        websocket: prefix === "/api", // the terminal is a websocket
        preHandler: async (req, reply) => {
          if (isBlocked(req.method, req.url)) {
            session?.log("agent_request_blocked", { method: req.method, url: req.url });
            return reply.code(403).send({ error: "not available in this study" });
          }
        },
        replyOptions: { rewriteRequestHeaders: (_req, headers) => auth(headers) },
        wsClientOptions: { rewriteRequestHeaders: (headers: Record<string, unknown>) => auth(headers) },
      });
    }
  }

  if (cfg.staticDir && fs.existsSync(cfg.staticDir)) {
    const root = path.resolve(cfg.staticDir);
    app.register(fastifyStatic, { root });
    // Deep links into the app (/server/<key>/session/<id>) are client-side routes: serve the app shell.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/_study/")) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not found" });
    });
  }
  return app;
}
