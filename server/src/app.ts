import { randomInt } from "node:crypto";
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
  /** Demo deployment: after Finish, start a fresh session (new ID, seed and next group) instead of stopping. */
  demo?: boolean;
  /** Experimenter aid: show the regime/variant tag in the UI. Never enable for real participants. */
  showCondition?: boolean;
  /** URL of the dev server inside the container as seen from the participant's browser; enables the Preview pane. */
  previewUrl?: string;
  sandbox: SandboxOptions;
  /** Paths the sandbox uid must not be able to read (checked at startup). */
  protectedPaths?: string[];
  sandboxRoot?: string;
}

export function buildApp(cfg: ServerConfig) {
  assertUnreadable(cfg.protectedPaths ?? [], cfg.sandbox);

  const loadStory = makeStoryLoader(cfg.corpusDir, cfg.devFallbackStory);
  let session!: StudySession;
  let terminals: TerminalManager | undefined;
  const start = (participantId: string, studySeed: string, group?: number) => {
    const plan = generateSessionPlan({ participantId, studySeed, group });
    const sink = makeEventSink(cfg.exportDir, participantId, studySeed);
    session = new StudySession(plan, loadStory, sink, Date.now, () => terminals?.sync(), cfg.showCondition ?? false);
    terminals = new TerminalManager(session, cfg.sandbox, cfg.sandboxRoot);
    return plan;
  };
  let group = start(cfg.participantId, cfg.studySeed, cfg.group).group;

  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: err.issues });
    app.log.error(err);
    return reply.code(500).send({ error: "internal error" });
  });

  const withPreview = <T extends object>(v: T) => ({ ...v, ...(cfg.previewUrl ? { previewUrl: cfg.previewUrl } : {}), ...(cfg.demo ? { demo: true } : {}) });
  app.get("/api/study/state", async () => withPreview(session.view()));
  app.post("/api/study/action", async (req) => withPreview(await session.act(req.body)));
  const UiEvent = z.object({ type: z.enum(["file_open", "tab_switch", "diff_toggle", "preview_navigate"]), path: z.string().max(200).optional(), tab: z.string().max(40).optional() });
  app.post("/api/study/event", async (req) => {
    const { type, ...data } = UiEvent.parse(req.body);
    session.recordUi(type, data);
    return { ok: true };
  });
  app.post("/api/study/finish", async (_req, reply) => {
    const bundle = session.finish();
    writeBundle(cfg.exportDir, bundle);
    terminals!.dispose();
    if (cfg.demo) {
      // Same ID format as scripts/run-session.sh; the next group keeps a run of demos balanced too.
      const id = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("");
      group = start(id, String(randomInt(2 ** 32)), (group + 1) % 6).group;
    }
    await reply.send({ ok: true, restarted: cfg.demo === true });
    if (cfg.exitOnFinish && !cfg.demo) setImmediate(() => process.exit(0));
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
