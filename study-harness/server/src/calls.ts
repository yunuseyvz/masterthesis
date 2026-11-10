import { z } from "zod";

/**
 * Model calls as the live endpoint records them (proxy.ts): every request opencode made to the model and the
 * response stream it got back, chunk by chunk with timings.
 */
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
  /** Milliseconds after the trial started. */
  at: z.number().nonnegative(),
  request: z.object({
    model: z.string().optional(),
    /** Streamed (server-sent events) or one JSON body; a non-streamed response is stored as a single chunk. */
    stream: z.boolean(),
    /** Names of the tools offered to the model. */
    tools: z.array(z.string()),
    messages: z.number().int().nonnegative(),
    /** The last message's text, shortened; for reading the log. */
    preview: z.string(),
  }),
  status: z.number().int(),
  chunks: z.array(Chunk),
  /** The answer's text did not reach opencode (the planning turn). */
  textDropped: z.boolean().optional(),
  /** The text opencode got where the proxy checked it first (`guard`); it differs from the chunks' text if it was replaced. */
  textShown: z.string().optional(),
});
export type Call = z.infer<typeof Call>;

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
 * first real user message with the workspace path neutralised.
 */
export function threadKey(body: { messages?: Message[]; tools?: unknown[] }, workspaceDir: string): string {
  const first = (body.messages ?? []).find((m) => m.role === "user" && !isReminder(m));
  const text = messageText(first).split(workspaceDir).join("<workspace>");
  return `${body.tools?.length ? "t" : "n"}:${hash(text)}`;
}

/**
 * Assistant messages in a request, ignoring the texts in `ignore` and empty ones (silent replies). A request's
 * position in its thread.
 */
export function assistantCount(body: { messages?: Message[] }, ignore: readonly string[] = []): number {
  return (body.messages ?? []).filter((m) => {
    if (m.role !== "assistant") return false;
    const text = messageText(m);
    if (ignore.includes(text.trim())) return false;
    return text !== "" || (m.tool_calls?.length ?? 0) > 0;
  }).length;
}

/** A streamed response, reassembled: its text, its tool calls (name and JSON arguments), and the model's reasoning. */
export interface ParsedResponse {
  text: string;
  tools: { id?: string; name: string; args: string }[];
  finish?: string;
  /** The last `usage` in the stream, as the model reported it. */
  usage?: unknown;
  /** The reasoning, and the field the model sent it in. */
  reasoning?: { field: string; text: string };
}

export function parseChunks(chunks: readonly Chunk[]): ParsedResponse {
  const out: ParsedResponse = { text: "", tools: [] };
  for (const c of chunks) {
    if (c.data === "[DONE]") continue;
    let ev: { usage?: unknown; choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[] };
    try {
      ev = JSON.parse(c.data);
    } catch {
      continue;
    }
    if (ev.usage) out.usage = ev.usage;
    const choice = ev.choices?.[0];
    if (!choice) continue;
    if (choice.delta?.content) out.text += choice.delta.content;
    for (const field of ["reasoning_content", "reasoning"] as const) {
      const part = choice.delta?.[field];
      if (part) out.reasoning = { field, text: (out.reasoning?.text ?? "") + part };
    }
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
