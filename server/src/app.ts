import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { ZodError, z } from "zod";
import { generateSessionPlan } from "@beacon/shared";
import { makeStoryLoader } from "./corpus.js";
import { makeEventSink, writeBundle } from "./export.js";
import { ConflictError, StudySession } from "./machine.js";
import { TerminalManager, assertUnreadable, type SandboxOptions } from "./terminal.js";

export interface ServerConfig {
  participantId: string;
  studySeed: string;
  group?: number;
  exportDir: string;
  corpusDir: string;
  staticDir?: string;
  /** Dev only: reuse this story for any story missing from the corpus. */
  devFallbackStory?: string;
  exitOnFinish: boolean;
  sandbox: SandboxOptions;
  /** Paths the sandbox uid must not be able to read (checked at startup). */
  protectedPaths?: string[];
  sandboxRoot?: string;
}

export function buildApp(cfg: ServerConfig) {
  assertUnreadable(cfg.protectedPaths ?? [], cfg.sandbox);

  const plan = generateSessionPlan({ participantId: cfg.participantId, studySeed: cfg.studySeed, group: cfg.group });
  const sink = makeEventSink(cfg.exportDir, cfg.participantId, cfg.studySeed);
  let terminals: TerminalManager | undefined;
  const session = new StudySession(plan, makeStoryLoader(cfg.corpusDir, cfg.devFallbackStory), sink, Date.now, () => terminals?.sync());
  terminals = new TerminalManager(session, cfg.sandbox, cfg.sandboxRoot);

  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: err.issues });
    app.log.error(err);
    return reply.code(500).send({ error: "internal error" });
  });

  app.get("/api/study/state", async () => session.view());
  app.post("/api/study/action", async (req) => session.act(req.body));
  const UiEvent = z.object({ type: z.enum(["file_open", "tab_switch", "diff_toggle"]), path: z.string().max(200).optional(), tab: z.string().max(40).optional() });
  app.post("/api/study/event", async (req) => {
    const { type, ...data } = UiEvent.parse(req.body);
    session.recordUi(type, data);
    return { ok: true };
  });
  app.post("/api/study/finish", async (_req, reply) => {
    const bundle = session.finish();
    writeBundle(cfg.exportDir, bundle);
    terminals!.dispose();
    await reply.send({ ok: true });
    if (cfg.exitOnFinish) setImmediate(() => process.exit(0));
    return reply;
  });

  // Terminal: client -> {t:"i",d} | {t:"r",cols,rows}; server -> raw pty output text.
  app.register(async (scope) => {
    scope.get("/api/study/terminal", { websocket: true }, (socket, req) => {
      const q = req.query as { cols?: string; rows?: string };
      const size = { cols: Math.min(Number(q.cols) || 80, 400), rows: Math.min(Number(q.rows) || 24, 200) };
      const conn = terminals!.open(size, (d) => socket.send(d), () => socket.close());
      if (!conn) return socket.close(1008, "no checkpoint on screen");
      socket.on("message", (raw: Buffer | string) => {
        try {
          const m = JSON.parse(String(raw));
          if (m.t === "i" && typeof m.d === "string") conn.write(m.d);
          else if (m.t === "r") conn.resize(Number(m.cols), Number(m.rows));
        } catch { /* ignore malformed frames */ }
      });
      socket.on("close", () => conn.close());
    });
  });

  if (cfg.staticDir && fs.existsSync(cfg.staticDir)) {
    app.register(fastifyStatic, { root: path.resolve(cfg.staticDir) });
  }
  return app;
}
