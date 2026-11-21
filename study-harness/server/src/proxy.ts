import http from "node:http";
import { assistantCount, messageText, parseChunks, threadKey, type Call, type Chunk } from "./calls.js";

export interface ProxyOptions {
  upstream: string;
  apiKey?: string;
  workspaceDir: string;
  startedAt: number;
  log?: (line: string) => void;
  transform?: (body: ChatBody) => ChatBody;
  rewrite?: (data: string) => string;
  onCall?: (call: Call) => void;
  refuse?: (body: ChatBody) => string | null;
  onRefused?: (request: { method: string; path: string; reason: string }) => void;
  plan?: (body: ChatBody) => { text: string; deadline: number } | null;
  onPlan?: (answer: { reason: string; draft: string }) => void;
  guard?: (body: ChatBody) => ((text: string, toolsFollow: boolean) => string) | null;
}

// opencode calls <baseURL>/chat/completions with this proxy's /v1 as base
const CHAT_PATH = "/v1/chat/completions";

export type ChatBody = { model?: string; stream?: boolean; messages?: { role?: string; content?: unknown; tool_calls?: unknown[]; [field: string]: unknown }[]; tools?: { function?: { name?: string } }[] };

type StreamEvent = { choices?: { delta?: { content?: unknown; tool_calls?: unknown; [field: string]: unknown }; finish_reason?: string | null; [field: string]: unknown }[]; usage?: unknown; [field: string]: unknown };

const dataOf = (frame: string) => frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");

// Forwards chat completions to the real model and records each event with its arrival time. Nothing else goes
// upstream: the endpoint holds the key and the participant's terminal can reach it.
export class RecordingProxy {
  readonly calls: Call[] = [];
  private server: http.Server | null = null;

  constructor(private readonly o: ProxyOptions) {}

  listen(port = 0): Promise<number> {
    this.server = http.createServer((req, res) => void this.handle(req, res).catch((err) => {
      this.o.log?.(`proxy error: ${String(err)}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }));
    return new Promise((resolve) => this.server!.listen(port, "127.0.0.1", () => resolve((this.server!.address() as { port: number }).port)));
  }

  close() {
    this.server?.close();
  }

  private upstreamUrl(reqPath: string) {
    return this.o.upstream.replace(/\/$/, "") + reqPath.replace(/^\/v1/, "");
  }

  // client headers pass through except hop headers; the upstream key replaces opencode's placeholder
  private headers(req: http.IncomingMessage): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v !== "string" || /^(host|content-length|connection|accept-encoding|transfer-encoding)$/i.test(k)) continue;
      out[k] = v;
    }
    out["content-type"] ??= "application/json";
    if (this.o.apiKey) out.authorization = `Bearer ${this.o.apiKey}`;
    return out;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunksIn: Buffer[] = [];
    for await (const c of req) chunksIn.push(c as Buffer);
    const raw = Buffer.concat(chunksIn).toString("utf8");

    const path = (req.url ?? "").split("?")[0]!;
    const refused = (status: number, reason: string) => {
      this.o.onRefused?.({ method: req.method ?? "", path, reason });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "not available in this study" } }));
    };
    if (req.method !== "POST" || path !== CHAT_PATH) return refused(404, "not the chat endpoint");
    let body: ChatBody;
    try {
      body = JSON.parse(raw) as ChatBody;
    } catch {
      return refused(400, "not JSON");
    }
    const reason = this.o.refuse?.(body);
    if (reason) return refused(403, reason);

    const index = this.calls.length;
    const received = Date.now();
    const call: Call = {
      index,
      thread: threadKey(body, this.o.workspaceDir),
      position: assistantCount(body),
      at: received - this.o.startedAt,
      request: {
        model: body.model,
        stream: body.stream === true,
        tools: (body.tools ?? []).map((t) => t.function?.name ?? "?"),
        messages: body.messages?.length ?? 0,
        preview: messageText(body.messages?.at(-1)).slice(0, 200),
      },
      status: 0,
      chunks: [],
    };
    this.calls.push(call);

    const sent = this.o.transform ? JSON.stringify(this.o.transform(JSON.parse(raw) as ChatBody)) : raw;
    const upstream = (signal?: AbortSignal) => fetch(this.upstreamUrl(path), { method: "POST", headers: this.headers(req), body: sent, signal });

    const plan = body.stream === true ? this.o.plan?.(body) : null;
    if (plan) return this.planTurn(call, res, plan, upstream, received, body.model);

    let up: Response;
    try {
      up = await upstream();
    } catch (err) {
      this.o.onCall?.(call);
      throw err;
    }
    call.status = up.status;
    const type = up.headers.get("content-type") ?? "";
    res.writeHead(up.status, { "content-type": type || "application/json", "cache-control": "no-cache" });

    if (!type.includes("text/event-stream") || !up.body) {
      // Not streamed (e.g. a title, or an error): one chunk with the whole body.
      const text = await up.text();
      call.chunks.push({ t: Date.now() - received, data: text });
      res.end(this.o.rewrite?.(text) ?? text);
      this.o.onCall?.(call);
      return;
    }

    const guard = body.stream === true ? (this.o.guard?.(body) ?? null) : null;
    let held: { text: string; event: StreamEvent } | null = null;
    const out = (data: string) => res.write(`data: ${this.o.rewrite?.(data) ?? data}\n\n`);
    const release = (toolsFollow: boolean) => {
      if (!held || !guard) return;
      const shown = guard(held.text, toolsFollow);
      call.textShown = (call.textShown ?? "") + shown;
      held.event.choices![0]!.delta!.content = shown;
      if (shown) out(JSON.stringify(held.event));
      held = null;
    };
    const hold = (data: string): string | null => {
      let ev: StreamEvent;
      try {
        ev = JSON.parse(data) as StreamEvent;
      } catch {
        release(false); // [DONE]
        return data;
      }
      const choice = ev.choices?.[0];
      const text = choice?.delta?.content;
      const tools = Array.isArray(choice?.delta?.tool_calls) && choice.delta.tool_calls.length > 0;
      if (typeof text === "string" && text !== "") {
        held ??= { text: "", event: { ...ev, choices: [{ ...choice!, delta: { ...choice!.delta }, finish_reason: null }], usage: undefined } };
        held.text += text;
        delete choice!.delta!.content;
        if (!tools && !choice!.finish_reason && !ev.usage) return null;
        data = JSON.stringify(ev);
      }
      if (tools || choice?.finish_reason) release(tools);
      return data;
    };

    const reader = up.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = dataOf(frame);
        if (!data) {
          res.write(`${frame}\n\n`);
          continue;
        }
        call.chunks.push({ t: Date.now() - received, data } satisfies Chunk);
        const send = guard ? hold(data) : data;
        if (send !== null) out(send);
      }
    }
    release(false);
    res.end(buf);
    this.o.onCall?.(call);
    const r = parseChunks(call.chunks);
    this.o.log?.(`call ${index} ${call.thread} @${call.position} → ${up.status} ${((Date.now() - received) / 1000).toFixed(1)}s ${r.tools.map((t) => t.name).join(",") || JSON.stringify(r.text.slice(0, 60))}`);
  }

  // The planning turn runs in the background, so its answer can wait. Tool calls pass; the final text (or a slow or
  // failed answer) is replaced by plan.text, since the plan never depends on the model. A later request gets an empty answer.
  private async planTurn(call: Call, res: http.ServerResponse, plan: { text: string; deadline: number }, upstream: (signal: AbortSignal) => Promise<Response>, received: number, model?: string) {
    call.textDropped = true;
    let reason = "";
    const left = plan.text ? plan.deadline - Date.now() : 0;
    if (left <= 0) reason = "deadline";
    else {
      try {
        const up = await upstream(AbortSignal.timeout(left));
        call.status = up.status;
        if (!up.ok) reason = `status ${up.status}`;
        else for (const frame of (await up.text()).replace(/\r\n/g, "\n").split("\n\n")) {
          const data = dataOf(frame);
          if (data) call.chunks.push({ t: Date.now() - received, data });
        }
      } catch (err) {
        reason = err instanceof Error && err.name === "TimeoutError" ? "deadline" : "no answer";
      }
    }
    const parsed = parseChunks(call.chunks);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    if (!reason && parsed.tools.length > 0) {
      for (const { data } of call.chunks) res.write(`data: ${dropText(this.o.rewrite?.(data) ?? data)}\n\n`);
      res.end();
      this.o.onCall?.(call);
      return;
    }
    const event = (fields: object) => `data: ${JSON.stringify({ id: `plan-${call.index}`, object: "chat.completion.chunk", created: Math.floor(received / 1000), model, ...fields })}\n\n`;
    res.write(event({ choices: [{ index: 0, delta: { role: "assistant", content: plan.text }, finish_reason: null }] }));
    res.write(event({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }], ...(parsed.usage ? { usage: parsed.usage } : {}) }));
    res.end("data: [DONE]\n\n");
    this.o.onCall?.(call);
    if (plan.text) this.o.onPlan?.({ reason: reason || "the model's plan", draft: parsed.text });
  }
}

function dropText(data: string): string {
  try {
    const ev = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] };
    for (const c of ev.choices ?? []) if (c.delta) delete c.delta.content;
    return JSON.stringify(ev);
  } catch {
    return data; // [DONE]
  }
}
