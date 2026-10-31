import { parseChunks, threadKey, type Call } from "./calls.js";
import { RecordingProxy, type ChatBody, type ProxyOptions } from "./proxy.js";

/**
 * The model opencode talks to: a real model behind the recording proxy. The study server adds the trial's Drehbuch
 * (the agent's hidden script) to the system prompt of every request of the trial's main conversation on the way
 * upstream, so it never exists anywhere opencode, or the participant's terminal, can read it. Every call is recorded
 * and logged with its timing and token use.
 */

export interface LiveOptions {
  /** OpenAI-compatible API, e.g. https://opencode.ai/zen/go/v1. */
  upstream: string;
  apiKey?: string;
  log: (type: string, data: unknown) => void;
}

export interface LiveLoad {
  /** The trial's project folder (thread keys neutralise it). */
  workspaceDir: string;
  /** Thread key of the trial's main conversation (its first user message is the story request). */
  mainThread: string;
  /** The agent's script for this trial, appended to the main conversation's system prompt. */
  drehbuch: string;
  /** The trial's position in the session, logged with every call (a trial is prepared while the previous one ends). */
  trial?: number;
}

/** Token counts from the last chunk that carries them (OpenAI `usage`). */
function usageOf(call: Call): { prompt?: number; completion?: number; cached?: number } | undefined {
  for (let i = call.chunks.length - 1; i >= 0; i--) {
    try {
      const u = (JSON.parse(call.chunks[i]!.data) as { usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } }).usage;
      if (u) return { prompt: u.prompt_tokens, completion: u.completion_tokens, cached: u.prompt_tokens_details?.cached_tokens };
    } catch { /* [DONE] or not JSON */ }
  }
  return undefined;
}

/** The body with the Drehbuch added to its system prompt (or as one, if the request has none). */
export function withDrehbuch(body: ChatBody, drehbuch: string): ChatBody {
  const messages = [...(body.messages ?? [])];
  const i = messages.findIndex((m) => m.role === "system");
  const block = `\n\n${drehbuch}`;
  if (i < 0) messages.unshift({ role: "system", content: drehbuch });
  else {
    const m = messages[i]!;
    const content = typeof m.content === "string" ? m.content + block : Array.isArray(m.content) ? [...m.content, { type: "text", text: block }] : drehbuch;
    messages[i] = { ...m, content };
  }
  return { ...body, messages };
}

export class LiveEndpoint {
  private l: LiveLoad | null = null;
  private first = 0;
  private readonly opts: ProxyOptions;
  private readonly proxy: RecordingProxy;

  constructor(private readonly o: LiveOptions) {
    this.opts = {
      upstream: o.upstream,
      apiKey: o.apiKey,
      workspaceDir: "",
      startedAt: Date.now(),
      transform: (body) => (this.l && threadKey(body, this.l.workspaceDir) === this.l.mainThread ? withDrehbuch(body, this.l.drehbuch) : body),
      onCall: (call) => this.logCall(call),
    };
    this.proxy = new RecordingProxy(this.opts);
  }

  /** A new live trial. */
  load(l: LiveLoad) {
    this.l = l;
    this.opts.workspaceDir = l.workspaceDir;
    this.opts.startedAt = Date.now();
    this.first = this.proxy.calls.length;
  }

  /** Calls of the current trial. */
  calls(): Call[] {
    return this.proxy.calls.slice(this.first);
  }

  private logCall(call: Call) {
    const r = parseChunks(call.chunks);
    const main = this.l !== null && call.thread === this.l.mainThread;
    this.o.log("live_call", {
      trial: this.l?.trial ?? null,
      thread: main ? "main" : call.thread,
      position: call.position,
      status: call.status,
      firstChunkMs: call.chunks[0]?.t ?? null,
      ms: call.chunks.at(-1)?.t ?? null,
      tools: r.tools.map((t) => t.name),
      finish: r.finish ?? null,
      usage: usageOf(call) ?? null,
    });
  }

  listen(port: number) {
    return this.proxy.listen(port);
  }

  close() {
    this.proxy.close();
  }
}
