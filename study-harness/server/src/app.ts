import { randomInt } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import Fastify from "fastify";
import fastifyHttpProxy from "@fastify/http-proxy";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { generateSessionPlan, type Regime, type SessionPlan, type Variant } from "@beacon/shared";
import { FakeAgentHost, OpencodeHost, type AgentHost } from "./agent.js";
import { CheckpointServer } from "./checkpoint.js";
import { LiveEndpoint } from "./live.js";
import { referenceSteps } from "./reference.js";
import { makeStoryLoader } from "./trial.js";
import { makeEventSink, writeBundle } from "./export.js";
import { ConflictError, StudySession, type AgentDeps } from "./machine.js";
import { assertProbeRuns, assertUnreadable, killUserProcesses, type SandboxOptions } from "./sandbox.js";

export interface ServerConfig {
  participantId: string;
  studySeed: string;
  group?: number;
  /** Earlier sessions of this group; balances the NON_MILESTONE pause step (see generateSessionPlan). */
  round?: number;
  exportDir: string;
  /** Trial definitions (study-harness/trials): the stories, their Drehbuch outlines and questions. */
  trialsDir: string;
  /** The project every trial starts from (study-harness/project). */
  projectDir: string;
  staticDir?: string;
  exitOnFinish: boolean;
  /** Demo deployment: after Finish, start a fresh session (new ID, seed and next group) instead of stopping. */
  demo?: boolean;
  /** Screen recording of the agent UI with rrweb, written to <participant>_<seed>.recording.jsonl. */
  recording?: boolean;
  /** Experimenter aid: show the regime/variant tag in the UI. Never enable for real participants. */
  showCondition?: boolean;
  /** Where the browser reaches this server, when a study platform puts it under a path of its own (default "/"). */
  basePath?: string;
  /** Where the browser goes after Finish, when a study platform wants it back. */
  completionUrl?: string;
  /** Development: play this story, regime and variant as the practice trial (e.g. to try a live trial first). */
  tryTrial?: { story: string; regime: Regime; variant: Variant };
  sandbox: SandboxOptions;
  /** Paths the sandbox uid must not be able to read (checked at startup). */
  protectedPaths?: string[];
  /** Root for the per-trial project folders the agent works in. */
  workRoot: string;
  /**
   * "opencode": real opencode with the model that plays the agent from each trial's Drehbuch (OpenAI-compatible
   * upstream). "fake": a stand-in that writes the reference code, without a UI (tests and flow development only).
   */
  agent:
    | { kind: "fake" }
    | { kind: "opencode"; bin: string; port: number; home: string; live: { upstream: string; apiKey?: string; model: string; port: number; checkpointPort: number } };
}

/**
 * opencode API calls the participant's browser may not make: everything that would change the session (prompting the
 * agent, switching agents, reverting, forking, compacting, deleting or creating sessions). The study server drives
 * the agent itself, directly and not through this proxy; the one exception is the participant's answer when the
 * agent asks what to change after a rejection (StudySession.acceptsComposerMessage).
 */
const BLOCKED: [string, RegExp][] = [
  // The checkpoint tool's MCP server and opencode's configuration are the study's. (Not the session's model: the
  // composer sends it before every message, and opencode's configuration has only the live model anyway.)
  ["PUT", /^\/api\/experimental\/mcp\//],
  ["DELETE", /^\/api\/experimental\/mcp\//],
  ["POST", /^\/api\/experimental\/mcp\//],
  ["PATCH", /^\/api\/experimental\/config(\?|$)/],
  ["POST", /^\/api\/session\/?(\?|$)/],
  ["DELETE", /^\/api\/session\/[^/]+\/?(\?|$)/],
  ["POST", /^\/api\/session\/[^/]+\/(prompt|command|shell|synthetic|agent|fork|compact|revert\/.*|generate)(\?|$)/],
  ["DELETE", /^\/api\/session\/[^/]+\/revert(\?|$)/],
  ["POST", /^\/api\/session\/[^/]+\/(archive|share)/],
];
export const isBlocked = (method: string, url: string) => BLOCKED.some(([m, re]) => m === method && re.test(url));

/** The path the agent UI is built for (agent-ui/build.sh); a pod belongs to one participant, so it is set once, at start. */
const BASE_PLACEHOLDER = "/__STUDY_BASE__/";

/** Puts the app's path into the built agent UI. Nothing to do once it is there (a restarted container). */
export function setBasePath(dir: string, basePath: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) setBasePath(p, basePath);
    else if (/\.(js|css|html|webmanifest)$/.test(e.name)) {
      const text = fs.readFileSync(p, "utf8");
      if (text.includes(BASE_PLACEHOLDER)) fs.writeFileSync(p, text.split(BASE_PLACEHOLDER).join(basePath));
    }
  }
}

export async function buildApp(cfg: ServerConfig) {
  assertUnreadable(cfg.protectedPaths ?? [], cfg.sandbox);
  assertProbeRuns(cfg.sandbox);
  const loadStory = makeStoryLoader(cfg.trialsDir, cfg.projectDir);

  let session!: StudySession;
  let plan!: SessionPlan;
  let recordingFile = "";
  // Events from the agent and the model endpoint belong to whichever session is current.
  const log = (type: string, data: unknown) => session?.log(type, data);
  let agent: AgentHost;
  let deps: Pick<AgentDeps, "endpoint" | "checkpoints">;
  let closeLive = () => {};
  if (cfg.agent.kind === "opencode") {
    const { live } = cfg.agent;
    // Both listen before opencode starts: it connects to the checkpoint tool's MCP server at startup.
    const endpoint = new LiveEndpoint({ upstream: live.upstream, apiKey: live.apiKey, model: live.model, log });
    const checkpoints = new CheckpointServer(log);
    await endpoint.listen(live.port);
    await checkpoints.listen(live.checkpointPort);
    closeLive = () => {
      endpoint.close();
      checkpoints.close();
    };
    deps = { endpoint, checkpoints };
    agent = await new OpencodeHost({
      bin: cfg.agent.bin,
      port: cfg.agent.port,
      live: { url: `http://127.0.0.1:${live.port}/v1`, model: live.model, checkpointUrl: `http://127.0.0.1:${live.checkpointPort}/mcp` },
      home: cfg.agent.home,
      sandbox: cfg.sandbox,
      log,
    }).start();
  } else {
    const fake = new FakeAgentHost(referenceSteps(loadStory, () => [plan.practice, ...plan.trials]));
    agent = fake;
    deps = { endpoint: { load: () => {}, endPlanning: () => {} }, checkpoints: fake.checkpoints };
  }

  const start = (participantId: string, studySeed: string, group?: number, round?: number) => {
    plan = generateSessionPlan({ participantId, studySeed, group, round });
    if (cfg.tryTrial) plan.practice = { ...plan.practice, ...cfg.tryTrial, story: cfg.tryTrial.story as typeof plan.practice.story };
    const sink = makeEventSink(cfg.exportDir, participantId, studySeed);
    session = new StudySession(plan, loadStory, { agent, ...deps, workRoot: path.join(cfg.workRoot, participantId), sandbox: cfg.sandbox }, sink, Date.now, cfg.showCondition ?? false);
    recordingFile = path.join(cfg.exportDir, `${participantId}_${studySeed}.recording.jsonl`);
    return plan;
  };
  let group = start(cfg.participantId, cfg.studySeed, cfg.group, cfg.round).group;

  const app = Fastify({ logger: false });
  app.addHook("onClose", async () => {
    agent.close();
    closeLive();
  });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: err.issues });
    // The browser dropped a request before it was read (a page load or a reconnecting tunnel): nothing failed here.
    if ((err as Error).message === "aborted" || (err as { code?: string }).code === "ECONNRESET") {
      session?.log("client_aborted", { url: _req.url });
      return reply.code(499).send({ error: "client closed request" });
    }
    app.log.error(err);
    session?.log("server_error", { message: String(err) });
    return reply.code(500).send({ error: "internal error" });
  });

  const decorate = <T extends object>(v: T) => ({ ...v, ...(cfg.demo ? { demo: true } : {}), ...(cfg.recording ? { recording: true } : {}), ...(cfg.completionUrl ? { completionUrl: cfg.completionUrl } : {}) });
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
          // Live, after a rejection: the participant's one answer to the agent, from opencode's own composer.
          if (session?.acceptsComposerMessage(req.method, req.url)) {
            let body = "";
            for await (const chunk of req.body as AsyncIterable<Buffer | string>) body += chunk;
            const res = await session.composerMessage(req.url, body);
            return reply.code(res.status).type("application/json").send(res.body);
          }
          if (isBlocked(req.method, req.url)) {
            session?.log("agent_request_blocked", { method: req.method, url: req.url });
            return reply.code(403).send({ error: "not available in this study" });
          }
        },
        // The chat is a server-sent event stream; a reverse proxy in front must not hold it back.
        replyOptions: { rewriteRequestHeaders: (_req, headers) => auth(headers), rewriteHeaders: (headers) => ({ ...headers, "x-accel-buffering": "no" }) },
        wsClientOptions: { rewriteRequestHeaders: (headers: Record<string, unknown>) => auth(headers) },
      });
    }
  }

  if (cfg.staticDir && fs.existsSync(cfg.staticDir)) {
    setBasePath(cfg.staticDir, cfg.basePath ?? "/");
    // opencode's web app installs a service worker that caches the whole app, so a browser would keep showing an
    // older study build (an earlier session on the same address). This one replaces it: it clears the caches,
    // unregisters itself and reloads the open pages, which then load the current build from the server.
    app.get("/sw.js", async (_req, reply) =>
      reply
        .type("application/javascript")
        .header("cache-control", "no-store")
        .send(
          `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) await caches.delete(key);
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
})()));`,
        ),
    );
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
