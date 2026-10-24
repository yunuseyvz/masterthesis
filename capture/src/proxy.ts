import http from "node:http";
import { assistantCount, messageText, parseChunks, threadKey, type Call, type Chunk } from "@beacon/shared";

export interface ProxyOptions {
  /** OpenAI-compatible API the requests go to, e.g. https://openrouter.ai/api/v1. */
  upstream: string;
  apiKey?: string;
  /** The project folder of the session (thread keys neutralise it). */
  workspaceDir: string;
  /** Snapshots the project and returns the commit id; called when a model request arrives. */
  snapshot: (label: string) => string;
  /** Capture start (Date.now()), for `Call.at`. */
  startedAt: number;
  log?: (line: string) => void;
}

/**
 * The model endpoint opencode talks to while a session is captured. It forwards every request to the real model
 * unchanged and streams the answer back unchanged, recording each server-sent event with the time it arrived.
 * Before forwarding, it snapshots the project: the state every earlier tool call left behind.
 */
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
    // opencode calls <baseURL>/chat/completions; the base URL it is given is this proxy's /v1.
    return this.o.upstream.replace(/\/$/, "") + reqPath.replace(/^\/v1/, "");
  }

  /**
   * The client's own request headers, passed on unchanged (the proxy is transparent), except those that describe the
   * hop itself; the upstream key replaces the placeholder opencode is configured with.
   */
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

    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      // Anything else (model lists) passes through unrecorded.
      const up = await fetch(this.upstreamUrl(req.url ?? "/"), { method: req.method, headers: this.headers(req), body: req.method === "GET" ? undefined : raw });
      res.writeHead(up.status, { "content-type": up.headers.get("content-type") ?? "application/json" });
      res.end(Buffer.from(await up.arrayBuffer()));
      return;
    }

    const body = JSON.parse(raw) as { model?: string; stream?: boolean; messages?: { role?: string; content?: unknown }[]; tools?: { function?: { name?: string } }[] };
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
      snapshot: this.o.snapshot(`call ${index}`),
    };
    this.calls.push(call);

    if (process.env.CAPTURE_DEBUG) this.o.log?.(`request headers: ${Object.keys(req.headers).join(", ")}`);
    const up = await fetch(this.upstreamUrl(req.url), { method: "POST", headers: this.headers(req), body: raw });
    call.status = up.status;
    const type = up.headers.get("content-type") ?? "";
    res.writeHead(up.status, { "content-type": type || "application/json", "cache-control": "no-cache" });

    if (!type.includes("text/event-stream") || !up.body) {
      // Not streamed (e.g. a title, or an error): one chunk with the whole body.
      const text = await up.text();
      call.chunks.push({ t: Date.now() - received, data: text });
      res.end(text);
      return;
    }

    const reader = up.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
        if (data) call.chunks.push({ t: Date.now() - received, data } satisfies Chunk);
      }
    }
    res.end();
    const r = parseChunks(call.chunks);
    this.o.log?.(`call ${index} ${call.thread} @${call.position} → ${up.status} ${((Date.now() - received) / 1000).toFixed(1)}s ${r.tools.map((t) => t.name).join(",") || JSON.stringify(r.text.slice(0, 60))}`);
  }
}
