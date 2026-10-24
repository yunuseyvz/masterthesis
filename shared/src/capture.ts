import { z } from "zod";

/**
 * A capture is a real opencode session recorded at the model boundary: every request opencode made to the model and
 * the response stream it got back, chunk by chunk with timings, plus the workspace as it was before each request.
 * The capture tool (capture/) writes captures; the study harness (harness/) replays them 1:1.
 *
 * On disk a capture is a folder: `capture.json` (this schema) and `history.bundle` (a git bundle with one commit per
 * snapshot of the workspace).
 */
export const CAPTURE_FORMAT = "beacon-capture/1";

/** One server-sent event of the model's streamed response (an OpenAI chat-completions chunk, or "[DONE]"). */
export const Chunk = z.object({
  /** Milliseconds after the request arrived. */
  t: z.number().nonnegative(),
  /** The event's `data:` payload, verbatim. */
  data: z.string(),
});
export type Chunk = z.infer<typeof Chunk>;

export const Call = z.object({
  /** Order in which opencode made the request (all threads). */
  index: z.number().int().nonnegative(),
  /** Conversation the request belongs to (see `threadKey`): the main session, a subagent, or a side request such as a title. */
  thread: z.string(),
  /** Assistant messages already in the request (see `assistantCount`): the request's position in its thread. */
  position: z.number().int().nonnegative(),
  /** Milliseconds after the capture started. */
  at: z.number().nonnegative(),
  request: z.object({
    model: z.string().optional(),
    /** Streamed (server-sent events) or one JSON body; a non-streamed response is stored as a single chunk. */
    stream: z.boolean(),
    /** Names of the tools offered to the model. */
    tools: z.array(z.string()),
    messages: z.number().int().nonnegative(),
    /** The last message's text, shortened; for inspecting a capture. */
    preview: z.string(),
  }),
  status: z.number().int(),
  chunks: z.array(Chunk),
  /** Workspace snapshot (commit in history.bundle) when the request arrived, i.e. after every earlier tool call ran. */
  snapshot: z.string(),
});
export type Call = z.infer<typeof Call>;

/** A message the person driving the session sent (the participant's turns in the replay). */
export const Turn = z.object({
  text: z.string(),
  /** opencode agent the turn ran with ("plan", "build", ...). */
  agent: z.string().optional(),
  at: z.number().nonnegative(),
});
export type Turn = z.infer<typeof Turn>;

export const Capture = z.object({
  format: z.literal(CAPTURE_FORMAT),
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  createdAt: z.string(),
  /** How it was made: a real model through the capture proxy, or synthesized from a scripted story. */
  source: z.enum(["recorded", "synthetic"]),
  opencodeVersion: z.string().optional(),
  model: z.object({ id: z.string(), upstream: z.string().optional() }),
  /** Standing instructions the agent had during the capture (opencode's global AGENTS.md); the replay never sends them. */
  brief: z.string().optional(),
  workspace: z.object({
    /** Absolute path of the project during the capture; the replay rewrites it to the trial's own folder. */
    dir: z.string(),
    /** Snapshot before the first request (the project as the session found it). */
    initial: z.string(),
    /** Snapshot after the session ended. */
    final: z.string(),
  }),
  /** Thread key of the main session (the one the person drove). */
  mainThread: z.string(),
  turns: z.array(Turn).min(1),
  calls: z.array(Call),
});
export type Capture = z.infer<typeof Capture>;

type Message = { role?: string; content?: unknown; tool_calls?: unknown[] };

/** Plain text of a chat message (string content or an array of text parts). */
export function messageText(m: Message | undefined): string {
  if (!m) return "";
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) return m.content.map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : "")).join("");
  return "";
}

export const isReminder = (m: Message | undefined) => m?.role === "user" && messageText(m).trimStart().startsWith("<system-reminder>");

/** 64-bit FNV-1a, as hex: a stable key that needs no crypto module. */
function hash(s: string): string {
  let h = 0xcbf29ce484222325n;
  for (const c of new TextEncoder().encode(s)) h = BigInt.asUintN(64, (h ^ BigInt(c)) * 0x100000001b3n);
  return h.toString(16).padStart(16, "0");
}

/**
 * Which conversation a model request belongs to: whether it offers tools (side requests like titles do not), and its
 * first real user message with the workspace path neutralised. Stable between a capture and its replay.
 */
export function threadKey(body: { messages?: Message[]; tools?: unknown[] }, workspaceDir: string): string {
  const first = (body.messages ?? []).find((m) => m.role === "user" && !isReminder(m));
  const text = messageText(first).split(workspaceDir).join("<workspace>");
  return `${body.tools?.length ? "t" : "n"}:${hash(text)}`;
}

/**
 * Assistant messages in a request, ignoring the ones the harness puts into a replayed conversation itself (`ignore`:
 * its pause and idle texts) and empty ones (silent replies). A request's position in its thread.
 */
export function assistantCount(body: { messages?: Message[] }, ignore: readonly string[] = []): number {
  return (body.messages ?? []).filter((m) => {
    if (m.role !== "assistant") return false;
    const text = messageText(m);
    if (ignore.includes(text.trim())) return false;
    return text !== "" || (m.tool_calls?.length ?? 0) > 0;
  }).length;
}

/** A recorded response, reassembled: its text and its tool calls (name and JSON arguments). */
export interface ParsedResponse {
  text: string;
  tools: { id?: string; name: string; args: string }[];
  finish?: string;
}

export function parseChunks(chunks: readonly Chunk[]): ParsedResponse {
  const out: ParsedResponse = { text: "", tools: [] };
  for (const c of chunks) {
    if (c.data === "[DONE]") continue;
    let ev: { choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[] };
    try {
      ev = JSON.parse(c.data);
    } catch {
      continue;
    }
    const choice = ev.choices?.[0];
    if (!choice) continue;
    if (choice.delta?.content) out.text += choice.delta.content;
    for (const tc of choice.delta?.tool_calls ?? []) {
      const i = tc.index ?? out.tools.length;
      out.tools[i] ??= { name: "", args: "" };
      if (tc.id) out.tools[i]!.id = tc.id;
      if (tc.function?.name) out.tools[i]!.name += tc.function.name;
      if (tc.function?.arguments) out.tools[i]!.args += tc.function.arguments;
    }
    if (choice.finish_reason) out.finish = choice.finish_reason;
  }
  return out;
}
