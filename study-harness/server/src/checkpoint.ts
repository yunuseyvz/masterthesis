import http from "node:http";

/** opencode's name for the tool: `<server>_<tool>` (the MCP server is configured as `review`). */
export const CHECKPOINT_TOOL = "review_checkpoint";

/** The answer when the agent may go straight on. */
export const CONTINUE = "Noted. Continue with the next step.";

/** What the study does when the agent reports a finished step; resolves with the tool's answer to the agent. */
export type CheckpointHandler = (step: number, summary: string) => Promise<string> | string;

const TOOL = {
  name: "checkpoint",
  description:
    "Report that a step of the plan is finished, before starting the next one. Wait for the answer and follow it.",
  inputSchema: {
    type: "object",
    properties: {
      step: { type: "integer", minimum: 1, maximum: 4, description: "Number of the step that is finished" },
      summary: { type: "string", description: "One sentence: what the step changed" },
    },
    required: ["step", "summary"],
  },
};

/** How often a waiting call sends a progress notification, so no client or proxy drops the idle connection. */
const KEEPALIVE_MS = 10_000;

type Rpc = { jsonrpc?: string; id?: string | number; method?: string; params?: { name?: string; arguments?: Record<string, unknown>; protocolVersion?: string; _meta?: { progressToken?: string | number } } };

/**
 * The live agent's checkpoint tool, served to opencode as a remote MCP server on loopback (streamable HTTP, JSON-RPC).
 * The agent calls it after each of steps 1-3; the study decides whether the call returns at once or waits until the
 * participant has reviewed. The agent calls it in every regime, so the conversation looks the same in all of them.
 */
export class CheckpointServer {
  private handler: CheckpointHandler = () => CONTINUE;
  private server: http.Server | null = null;

  constructor(private readonly log: (type: string, data: unknown) => void = () => {}) {}

  /** What the next calls do (set per trial). */
  setHandler(h: CheckpointHandler) {
    this.handler = h;
  }

  async listen(port: number, host = "127.0.0.1") {
    this.server = http.createServer((req, res) => void this.handle(req, res).catch((err) => {
      this.log("checkpoint_error", { message: String(err) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }));
    await new Promise<void>((resolve) => this.server!.listen(port, host, resolve));
    return (this.server.address() as { port: number }).port;
  }

  close() {
    this.server?.close();
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === "DELETE") return void res.writeHead(200).end();
    // No server-initiated stream: every answer goes on the request it belongs to.
    if (req.method !== "POST") return void res.writeHead(405, { allow: "POST, DELETE" }).end();
    let raw = "";
    for await (const d of req) raw += d;
    const msg = JSON.parse(raw) as Rpc;
    const reply = (result: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
    };
    switch (msg.method) {
      case "initialize":
        return reply({ protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "review", version: "1.0.0" } });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: [TOOL] });
      case "tools/call":
        return this.call(msg, res);
      default:
        // Notifications (no id) are acknowledged; unknown requests are an error.
        if (msg.id === undefined) return void res.writeHead(202).end();
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `unknown method ${msg.method}` } }));
    }
  }

  /** A tool call: answered as a server-sent event stream, with progress notifications while the study holds it. */
  private async call(msg: Rpc, res: http.ServerResponse) {
    const args = msg.params?.arguments ?? {};
    const step = Number(args.step);
    const summary = String(args.summary ?? "");
    const started = Date.now();
    this.log("checkpoint_call", { step, summary });
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    const send = (m: object) => res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", ...m })}\n\n`);
    const token = msg.params?._meta?.progressToken;
    let n = 0;
    const timer = setInterval(() => {
      if (token !== undefined) send({ method: "notifications/progress", params: { progressToken: token, progress: ++n } });
      else res.write(": keepalive\n\n");
    }, KEEPALIVE_MS);
    let closed = false;
    res.on("close", () => (closed = true));
    try {
      const text = msg.params?.name !== TOOL.name ? null : Number.isInteger(step) ? await this.handler(step, summary) : "Give the step number as an integer.";
      if (closed) {
        this.log("checkpoint_dropped", { step, ms: Date.now() - started });
        return;
      }
      if (text === null) send({ id: msg.id, error: { code: -32602, message: `unknown tool ${msg.params?.name}` } });
      else send({ id: msg.id, result: { content: [{ type: "text", text }] } });
      this.log("checkpoint_answer", { step, ms: Date.now() - started, text });
    } finally {
      clearInterval(timer);
      res.end();
    }
  }
}
