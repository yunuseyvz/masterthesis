import http from "node:http";
import { assistantCount, isReminder, parseChunks, threadKey, type Call, type Chunk } from "@beacon/shared";
import type { LoadedCapture } from "./captures.js";
import { patchArgs, type Patch } from "./trial.js";

/**
 * The model opencode talks to in the study: it replays a capture (capture-tool/) 1:1. Every request opencode makes is
 * matched to the recorded one (same conversation thread, same position in it) and answered with the recorded
 * stream, chunk by chunk with the recorded timing. opencode executes the recorded tool calls for real, so files,
 * diffs and test runs come out as they did in the captured session.
 *
 * The study adds three things: checkpoints (the agent stops before a given response and says so), variant patches
 * (one recorded tool call changed, e.g. to plant the flaw), and arming: the study server starts every turn itself and
 * the replay only advances the main conversation while a turn is armed.
 */

export const IDLE_REPLY = "I'm waiting for you. Please use the study panel on the right to continue.";
export const PAUSE_TEXT = "I've paused here so you can review what I've done so far. I'll go on when you're ready.";
/** Texts the harness puts into the conversation itself; they do not count as recorded responses. */
const INJECTED = [IDLE_REPLY, PAUSE_TEXT];

export interface ReplayLoad {
  capture: LoadedCapture;
  /** The trial's project folder; the capture's own folder is rewritten to it in everything the agent says and does. */
  workspaceDir: string;
  /** Changes to recorded tool calls (the variant). */
  patches: Patch[];
  /** Main-thread positions to stop before, once each (the checkpoints). */
  stops: number[];
  /** Called right before the main-thread response at a position is served (the study commits finished steps). */
  onServe?: (position: number) => void;
  /** The project after a main-thread response and its tool calls; only the fake agent (tests) needs it. */
  filesAfter?: (position: number) => Map<string, string>;
}

export type Reply =
  | { kind: "call"; call: Call; chunks: Chunk[]; main: boolean; endsTurn: boolean }
  | { kind: "text"; text: string };

type Body = { messages?: { role?: string; content?: unknown; tool_calls?: unknown[] }[]; tools?: unknown[]; stream?: boolean; model?: string };

/** Spreads a changed string over the original pieces' slots, keeping their number (and so the stream's timing). */
function redistribute(pieces: string[], next: string): string[] {
  const total = pieces.reduce((n, p) => n + p.length, 0) || 1;
  let at = 0;
  let cum = 0;
  return pieces.map((p, i) => {
    cum += p.length;
    const end = i === pieces.length - 1 ? next.length : Math.round((cum / total) * next.length);
    const s = next.slice(at, end);
    at = end;
    return s;
  });
}

/**
 * The captures were recorded with a hidden study brief (capture-tool/briefs/study.md), which participants never
 * see. Two plans name its file, `AGENTS.md`, and so does some reasoning text, but the trial's project has no such
 * file. Drop the references; the stream keeps its pieces and timing.
 */
export function scrubBriefRefs(s: string): string {
  return s
    .replace(/,\s+(?:following|matching) the four-step outline(?: for this story| in `AGENTS\.md`)/g, "")
    .replace(/\bAGENTS\.md (rules|step|outline|instructions)\b/g, "the brief's $1")
    .replace(/\bAGENTS\.md\b/g, "the brief")
    .replace(/\b(the|The) the brief\b/g, "$1 brief")
    .replace(/(^|[.!?]\s+)the brief\b/g, "$1The brief");
}

/** The recorded chunks with the project path rewritten and the patches applied. */
export function rewriteChunks(chunks: readonly Chunk[], from: string, to: string, patches: Patch[]): Chunk[] {
  const swap = (s: string) => (from && from !== to ? s.split(from).join(to) : s);
  const parsed = chunks.map((c) => {
    if (c.data === "[DONE]") return null;
    try {
      return JSON.parse(c.data) as Record<string, any>;
    } catch {
      return null;
    }
  });
  // A non-streamed body: the whole message in one chunk.
  const whole = parsed.length === 1 ? parsed[0]?.choices?.[0]?.message : undefined;
  if (whole) {
    if (typeof whole.content === "string") whole.content = swap(scrubBriefRefs(whole.content));
    if (typeof whole.reasoning_content === "string") whole.reasoning_content = swap(scrubBriefRefs(whole.reasoning_content));
    (whole.tool_calls ?? []).forEach((tc: { function?: { arguments?: string } }, k: number) => {
      let args = tc.function?.arguments ?? "";
      for (const p of patches.filter((x) => x.tool === k)) args = patchArgs(args, p);
      if (tc.function) tc.function.arguments = swap(args);
    });
    return [{ t: chunks[0]!.t, data: JSON.stringify(parsed[0]) }];
  }

  // Streamed: the text and each tool call's arguments arrive in pieces; collect them, change, and put them back.
  type Slot = { chunk: number; set: (s: string) => void; value: string };
  const streams = new Map<string, Slot[]>();
  parsed.forEach((ev, i) => {
    const delta = ev?.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string") (streams.get("text") ?? streams.set("text", []).get("text")!).push({ chunk: i, value: delta.content, set: (s) => (delta.content = s) });
    if (typeof delta.reasoning_content === "string") (streams.get("reasoning") ?? streams.set("reasoning", []).get("reasoning")!).push({ chunk: i, value: delta.reasoning_content, set: (s) => (delta.reasoning_content = s) });
    for (const tc of delta.tool_calls ?? []) {
      const fn = tc.function;
      if (typeof fn?.arguments !== "string") continue;
      const key = `tool:${tc.index ?? 0}`;
      (streams.get(key) ?? streams.set(key, []).get(key)!).push({ chunk: i, value: fn.arguments, set: (s) => (fn.arguments = s) });
    }
  });
  const changed = new Set<number>();
  for (const [key, slots] of streams) {
    const joined = slots.map((s) => s.value).join("");
    let next = joined;
    if (key.startsWith("tool:")) for (const p of patches.filter((x) => `tool:${x.tool}` === key)) next = patchArgs(next, p);
    else next = scrubBriefRefs(next); // the agent's words only; tool arguments stay as recorded
    next = swap(next);
    if (next === joined) continue;
    redistribute(slots.map((s) => s.value), next).forEach((piece, i) => {
      slots[i]!.set(piece);
      changed.add(slots[i]!.chunk);
    });
  }
  return chunks.map((c, i) => (changed.has(i) ? { t: c.t, data: JSON.stringify(parsed[i]) } : c));
}

export class ReplayEndpoint {
  private l: ReplayLoad | null = null;
  private armed = false;
  private passed = new Set<number>();
  private server: http.Server | null = null;

  constructor(
    private readonly log: (type: string, data: unknown) => void = () => {},
    /** Timing factor: 1 replays the recorded timing, 2 is twice as slow, 0 answers at once. */
    private readonly pace = 1,
  ) {}

  /** A new trial: its capture, variant and checkpoints. */
  load(l: ReplayLoad) {
    this.l = l;
    this.armed = false;
    this.passed = new Set();
  }

  /** See ReplayLoad.filesAfter. */
  filesAfter(position: number): Map<string, string> | undefined {
    return this.l?.filesAfter?.(position);
  }

  /** Lets the main conversation play until its turn ends or it reaches a checkpoint. */
  arm() {
    this.armed = true;
  }

  /** The recorded call for a request: same thread, same position (a retried request was answered once, successfully). */
  private recorded(thread: string, position: number): Call | undefined {
    return this.l!.capture.capture.calls.find((c) => c.thread === thread && c.position === position && c.status === 200);
  }

  /** Answers one chat-completions request body; exported for tests. */
  next(body: Body): Reply {
    const l = this.l;
    if (!l) return { kind: "text", text: IDLE_REPLY };
    const { capture } = l.capture;
    const thread = threadKey(body, l.workspaceDir);
    const position = assistantCount(body, INJECTED);
    const serve = (call: Call, main: boolean): Reply => {
      const patches = main ? l.patches.filter((p) => p.position === call.position) : [];
      const chunks = rewriteChunks(call.chunks, capture.workspace.dir, l.workspaceDir, patches);
      const endsTurn = main && parseChunks(chunks).tools.length === 0;
      this.log("replay_call", { thread: main ? "main" : thread, position: call.position, tools: parseChunks(chunks).tools.map((t) => t.name), endsTurn, patched: patches.length > 0 });
      return { kind: "call", call, chunks, main, endsTurn };
    };

    if (thread !== capture.mainThread) {
      // Subagents and side requests (session titles) play as recorded; without a recording, a neutral answer.
      const call = this.recorded(thread, position);
      if (call) return serve(call, false);
      return { kind: "text", text: body.tools?.length ? IDLE_REPLY : "Study session" };
    }
    if (!this.armed) {
      // Outside a turn: the participant cannot prompt (the proxy blocks it); stay silent after one of opencode's own
      // reminders, and otherwise point to the study panel.
      return { kind: "text", text: isReminder(body.messages?.at(-1)) ? "" : IDLE_REPLY };
    }
    if (l.stops.includes(position) && !this.passed.has(position)) {
      this.passed.add(position);
      this.armed = false;
      this.log("replay_checkpoint", { position });
      return { kind: "text", text: PAUSE_TEXT };
    }
    const call = this.recorded(thread, position);
    if (!call) {
      // Past the end of the capture.
      this.armed = false;
      return { kind: "text", text: IDLE_REPLY };
    }
    l.onServe?.(position);
    const reply = serve(call, true);
    if (reply.kind === "call" && reply.endsTurn) this.armed = false;
    return reply;
  }

  async listen(port: number, host = "127.0.0.1") {
    this.server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url?.endsWith("/models")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ object: "list", data: [{ id: "replay", object: "model", owned_by: "study" }] }));
      }
      if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
        res.writeHead(404);
        return res.end();
      }
      let raw = "";
      req.on("data", (d) => (raw += d));
      req.on("end", () => {
        let body: Body;
        try {
          body = JSON.parse(raw);
        } catch {
          res.writeHead(400);
          return res.end();
        }
        let reply: Reply;
        try {
          reply = this.next(body);
        } catch (err) {
          this.log("replay_error", { message: String(err) });
          reply = { kind: "text", text: IDLE_REPLY };
        }
        void send(res, reply, body, this.pace);
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(port, host, resolve));
  }

  close() {
    this.server?.close();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Streams a reply: a recorded call with its own timing, or a short text of the harness's own. */
async function send(res: http.ServerResponse, reply: Reply, body: Body, pace: number) {
  const start = Date.now();
  const wait = async (t: number) => {
    const due = start + t * pace;
    if (due > Date.now()) await sleep(due - Date.now());
  };
  if (reply.kind === "call") {
    if (!reply.call.request.stream || !body.stream) {
      await wait(reply.chunks[0]?.t ?? 0);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(reply.chunks[0]?.data ?? "{}");
    }
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    for (const c of reply.chunks) {
      await wait(c.t);
      res.write(`data: ${c.data}\n\n`);
    }
    return res.end();
  }
  const id = `replay-${start}`;
  const created = Math.floor(start / 1000);
  const model = body.model ?? "replay";
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  if (!body.stream) {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id, object: "chat.completion", created, model, usage, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: reply.text } }] }));
  }
  const ev = (delta: object, finish: string | null = null, extra: object = {}) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  res.write(ev({ role: "assistant", content: "" }));
  if (reply.text) {
    await wait(500);
    for (let i = 0; i < reply.text.length; i += 12) {
      res.write(ev({ content: reply.text.slice(i, i + 12) }));
      await sleep(40 * pace);
    }
  }
  res.write(ev({}, "stop", { usage }));
  res.end("data: [DONE]\n\n");
}
