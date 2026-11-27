import { z } from "zod";

export const Chunk = z.object({
  t: z.number().nonnegative(),
  data: z.string(),
});
export type Chunk = z.infer<typeof Chunk>;

export const Call = z.object({
  index: z.number().int().nonnegative(),
  thread: z.string(),
  position: z.number().int().nonnegative(),
  at: z.number().nonnegative(),
  request: z.object({
    model: z.string().optional(),
    stream: z.boolean(),
    tools: z.array(z.string()),
    messages: z.number().int().nonnegative(),
    preview: z.string(),
  }),
  status: z.number().int(),
  chunks: z.array(Chunk),
  // the planning turn: its text never reached opencode
  textDropped: z.boolean().optional(),
  // text opencode got after `guard`; differs from the chunks if replaced
  textShown: z.string().optional(),
});
export type Call = z.infer<typeof Call>;

type Message = { role?: string; content?: unknown; tool_calls?: unknown[] };

export function messageText(m: Message | undefined): string {
  if (!m) return "";
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) return m.content.map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : "")).join("");
  return "";
}

export const isReminder = (m: Message | undefined) => m?.role === "user" && messageText(m).trimStart().startsWith("<system-reminder>");

// 64-bit FNV-1a as hex: stable key without a crypto module
function hash(s: string): string {
  let h = 0xcbf29ce484222325n;
  for (const c of new TextEncoder().encode(s)) h = BigInt.asUintN(64, (h ^ BigInt(c)) * 0x100000001b3n);
  return h.toString(16).padStart(16, "0");
}

// keyed by whether the request offers tools (titles don't) and its first real user message, workspace path neutralised
export function threadKey(body: { messages?: Message[]; tools?: unknown[] }, workspaceDir: string): string {
  const first = (body.messages ?? []).find((m) => m.role === "user" && !isReminder(m));
  const text = messageText(first).split(workspaceDir).join("<workspace>");
  return `${body.tools?.length ? "t" : "n"}:${hash(text)}`;
}

// ignores texts in `ignore` and empty (silent) replies
export function assistantCount(body: { messages?: Message[] }, ignore: readonly string[] = []): number {
  return (body.messages ?? []).filter((m) => {
    if (m.role !== "assistant") return false;
    const text = messageText(m);
    if (ignore.includes(text.trim())) return false;
    return text !== "" || (m.tool_calls?.length ?? 0) > 0;
  }).length;
}

export interface ParsedResponse {
  text: string;
  tools: { id?: string; name: string; args: string }[];
  finish?: string;
  usage?: unknown;
  // the model that answered, as the upstream names it (may differ from the one asked for)
  model?: string;
  reasoning?: { field: string; text: string };
}

export function parseChunks(chunks: readonly Chunk[]): ParsedResponse {
  const out: ParsedResponse = { text: "", tools: [] };
  for (const c of chunks) {
    if (c.data === "[DONE]") continue;
    let ev: { model?: string; usage?: unknown; choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[] };
    try {
      ev = JSON.parse(c.data);
    } catch {
      continue;
    }
    if (ev.usage) out.usage = ev.usage;
    if (ev.model) out.model = ev.model;
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
