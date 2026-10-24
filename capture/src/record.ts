import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CAPTURE_FORMAT, Capture, threadKey, type Call, type Turn } from "@beacon/shared";
import { OpencodeServer, writeConfig } from "./opencode.js";
import { RecordingProxy } from "./proxy.js";
import { Snapshots } from "./snapshots.js";

export interface RecordOptions {
  id: string;
  /** Project the session starts from (copied; the copy becomes a fresh git repository). */
  seed: string;
  /** Capture folder to write (capture.json, history.bundle). */
  out: string;
  /** Model id at the upstream, e.g. "anthropic/claude-sonnet-4.5" on OpenRouter. */
  model: string;
  upstream: string;
  apiKey?: string;
  bin: string;
  /** Scripted turns sent through opencode's API instead of the interactive UI (tests, repeatable captures). */
  turns?: { text: string; agent?: string }[];
  /** Let the agent ask multiple-choice questions (off by default: a replay could not answer them). */
  allowQuestions?: boolean;
  /** Standing instructions for the agent (e.g. capture/briefs/study.md), hidden from the person driving the session. */
  brief?: string;
  /** Print the URL of opencode's web UI instead of starting its terminal UI; Ctrl+C ends the capture. */
  web?: boolean;
  log: (line: string) => void;
}

/** Copies the seed project into `dir` as a fresh git repository, as the harness does for a trial. */
function prepareProject(seed: string, dir: string) {
  fs.cpSync(seed, dir, { recursive: true, filter: (src) => !/[\\/](node_modules|\.git)$/.test(src) });
  if (!fs.existsSync(path.join(dir, ".gitignore"))) fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
  git("init", "-q");
  git("config", "user.name", "Coding agent");
  git("config", "user.email", "agent@shopfront.local");
  git("add", "-A");
  git("commit", "-qm", "Initial commit");
  // Dependencies are shared with the seed (installed once), as in the study containers.
  const modules = path.join(seed, "node_modules");
  if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(dir, "node_modules"), "dir");
}

/** An entry of opencode v2's message API (user and assistant messages, agent switches, idle markers, ...). */
type ApiMessage = { type?: string; text?: string; agent?: string; time?: { created?: number } };

/**
 * The person's messages in a session, oldest first, each with the agent it ran with (the session's starting agent,
 * then whatever an `agent-switched` entry set before it).
 */
export function userTurns(messages: ApiMessage[], startAgent: string | undefined, startedAt: number): Turn[] {
  const turns: Turn[] = [];
  let agent = startAgent;
  for (const m of [...messages].sort((x, y) => (x.time?.created ?? 0) - (y.time?.created ?? 0))) {
    if (m.type === "agent-switched" && m.agent) agent = m.agent;
    if (m.type !== "user" || !m.text?.trim()) continue;
    turns.push({ text: m.text, agent, at: Math.max(0, (m.time?.created ?? startedAt) - startedAt) });
  }
  return turns;
}

const list = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { data?: T[] })?.data ?? [])) as T[];

export async function record(o: RecordOptions): Promise<Capture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `capture-${o.id}-`));
  const work = path.join(root, o.id);
  prepareProject(o.seed, work);
  const snapshots = new Snapshots(work, path.join(root, "snapshots.git"));
  const initial = snapshots.take("initial");
  const startedAt = Date.now();

  const proxy = new RecordingProxy({ upstream: o.upstream, apiKey: o.apiKey, workspaceDir: work, snapshot: (l) => snapshots.take(l), startedAt, log: o.log });
  const port = await proxy.listen();
  const home = path.join(root, "home");
  writeConfig(home, `http://127.0.0.1:${port}/v1`, o.model, o.allowQuestions, o.brief);
  const server = await new OpencodeServer(o.bin, home).start(work);
  o.log(`project: ${work}`);

  let turns: Turn[] = [];
  let opencodeVersion: string | undefined;
  try {
    opencodeVersion = (await server.api<{ version?: string }>("GET", "/api/info").catch(() => ({ version: undefined }))).version;
    if (o.turns) {
      const r = await server.api<{ data: { id: string } }>("POST", "/api/session", { title: o.id, agent: o.turns[0]?.agent ?? "build", model: { id: o.model, providerID: "capture" }, location: { directory: work } });
      const id = r.data.id;
      for (const t of o.turns) {
        if (t.agent) await server.api("POST", `/api/session/${id}/agent`, { agent: t.agent });
        await server.api("POST", `/api/session/${id}/prompt`, { text: t.text });
        await server.waitIdle(id);
      }
    } else if (o.web) {
      o.log(`opencode web UI: ${server.url}  (user "opencode", password ${server.password})`);
      o.log("Work in the session; press Ctrl+C here when you are done.");
      await new Promise<void>((resolve) => process.once("SIGINT", () => resolve()));
    } else {
      await server.tui(work);
    }

    // The session the person drove: a top-level session in this project, with the most messages from them.
    const sessions = list<{ id: string; parentID?: string; agent?: string }>(await server.api("GET", `/api/session?directory=${encodeURIComponent(work)}&limit=100`));
    let best: Turn[] = [];
    for (const s of sessions.filter((s) => !s.parentID)) {
      // Pages of up to 200 entries, newest first, chained by an opaque cursor.
      const messages: ApiMessage[] = [];
      for (let cursor: string | undefined, guard = 0; guard < 100; guard++) {
        const page = await server.api<{ data?: ApiMessage[]; cursor?: { next?: string } }>("GET", `/api/session/${s.id}/message?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        messages.push(...(page.data ?? []));
        if ((page.data?.length ?? 0) < 200 || !page.cursor?.next) break;
        cursor = page.cursor.next;
      }
      const t = userTurns(messages, s.agent, startedAt);
      if (t.length > best.length) best = t;
    }
    turns = best;
  } finally {
    server.stop();
    proxy.close();
  }
  const final = snapshots.take("final");
  if (!turns.length) throw new Error("no user message found in the captured session");

  const calls: Call[] = proxy.calls;
  const byText = threadKey({ messages: [{ role: "user", content: turns[0]!.text }], tools: [{}] }, work);
  const counts = new Map<string, number>();
  for (const c of calls) if (c.request.tools.length) counts.set(c.thread, (counts.get(c.thread) ?? 0) + 1);
  const mainThread = counts.has(byText) ? byText : [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? byText;
  if (mainThread !== byText) o.log("warning: the main thread was picked by size, not by the first message");

  const capture = Capture.parse({
    format: CAPTURE_FORMAT,
    id: o.id,
    createdAt: new Date(startedAt).toISOString(),
    source: "recorded",
    opencodeVersion,
    model: { id: o.model, upstream: o.upstream },
    brief: o.brief,
    workspace: { dir: work, initial, final },
    mainThread,
    turns,
    calls,
  });
  fs.mkdirSync(o.out, { recursive: true });
  fs.writeFileSync(path.join(o.out, "capture.json"), JSON.stringify(capture, null, 1) + "\n");
  snapshots.bundle(path.resolve(o.out, "history.bundle"));
  fs.rmSync(root, { recursive: true, force: true });
  return capture;
}
