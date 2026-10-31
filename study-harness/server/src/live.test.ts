import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { threadKey } from "./calls.js";
import { CheckpointServer, CONTINUE } from "./checkpoint.js";
import { LiveEndpoint, withDrehbuch } from "./live.js";

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

/** JSON-RPC over the checkpoint server's HTTP endpoint; returns the parsed answer (the last event of a stream). */
async function rpc(port: number, body: object) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", ...body }) });
  const text = await res.text();
  if (!res.headers.get("content-type")?.includes("text/event-stream")) return { status: res.status, events: text ? [JSON.parse(text)] : [] };
  const events = text.split("\n\n").map((f) => f.split("\n").find((l) => l.startsWith("data: "))?.slice(6)).filter(Boolean).map((d) => JSON.parse(d!));
  return { status: res.status, events };
}

describe("checkpoint tool (MCP)", () => {
  it("initializes and lists the tool", async () => {
    const server = new CheckpointServer();
    const port = await server.listen(0);
    closers.push(() => server.close());
    const init = await rpc(port, { id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
    expect(init.events[0].result.protocolVersion).toBe("2025-06-18");
    expect((await rpc(port, { method: "notifications/initialized" })).status).toBe(202);
    const list = await rpc(port, { id: 2, method: "tools/list" });
    expect(list.events[0].result.tools.map((t: { name: string }) => t.name)).toEqual(["checkpoint"]);
  });

  it("answers at once, or holds the call until the study answers", async () => {
    const server = new CheckpointServer();
    const port = await server.listen(0);
    closers.push(() => server.close());
    let release!: (s: string) => void;
    const calls: number[] = [];
    server.setHandler((step) => {
      calls.push(step);
      return step === 2 ? new Promise<string>((r) => (release = r)) : CONTINUE;
    });
    const call = (step: number) => rpc(port, { id: step, method: "tools/call", params: { name: "checkpoint", arguments: { step, summary: "done" } } });
    const one = await call(1);
    expect(one.events.at(-1).result.content[0].text).toBe(CONTINUE);
    let answered = false;
    const two = call(2).then((r) => ((answered = true), r));
    await new Promise((r) => setTimeout(r, 100));
    expect(answered).toBe(false);
    release("go on");
    expect((await two).events.at(-1)).toMatchObject({ id: 2, result: { content: [{ type: "text", text: "go on" }] } });
    expect(calls).toEqual([1, 2]);
  });
});

describe("live endpoint", () => {
  it("adds the Drehbuch to the system prompt, or as one", () => {
    expect(withDrehbuch({ messages: [{ role: "system", content: "base" }, { role: "user", content: "hi" }] }, "SCRIPT").messages).toEqual([{ role: "system", content: "base\n\nSCRIPT" }, { role: "user", content: "hi" }]);
    expect(withDrehbuch({ messages: [{ role: "user", content: "hi" }] }, "SCRIPT").messages![0]).toEqual({ role: "system", content: "SCRIPT" });
  });

  it("forwards to the model, with the Drehbuch only in the trial's main conversation, and logs each call", async () => {
    const seen: { system: string; auth?: string }[] = [];
    const upstream = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (d) => (raw += d));
      req.on("end", () => {
        const body = JSON.parse(raw) as { messages: { role: string; content: string }[] };
        seen.push({ system: body.messages.find((m) => m.role === "system")?.content ?? "", auth: req.headers.authorization });
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2 } })}\n\n`);
        res.end("data: [DONE]\n\n");
      });
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    closers.push(() => upstream.close());
    const logs: { type: string; data: any }[] = [];
    const live = new LiveEndpoint({ upstream: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`, apiKey: "secret", log: (type, data) => logs.push({ type, data }) });
    const port = await live.listen(0);
    closers.push(() => live.close());
    const request = "As a shopper, I want a coupon.";
    live.load({ workspaceDir: "/work/x", mainThread: threadKey({ messages: [{ role: "user", content: request }], tools: [{}] }, "/work/x"), drehbuch: "SCRIPT" });
    const post = (body: object) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer live" }, body: JSON.stringify({ stream: true, ...body }) }).then((r) => r.text());
    await post({ messages: [{ role: "system", content: "base" }, { role: "user", content: request }], tools: [{ type: "function", function: { name: "write" } }] });
    await post({ messages: [{ role: "system", content: "title" }, { role: "user", content: request }] });
    expect(seen.map((s) => s.system)).toEqual(["base\n\nSCRIPT", "title"]);
    expect(seen[0]!.auth).toBe("Bearer secret");
    expect(live.calls()).toHaveLength(2);
    expect(logs.filter((l) => l.type === "live_call").map((l) => [l.data.thread, l.data.usage])).toEqual([["main", { prompt: 10, completion: 2, cached: undefined }], [expect.stringMatching(/^n:/), { prompt: 10, completion: 2, cached: undefined }]]);
  });
});

describe("adaptive options", () => {
  it("puts an outcome no option describes in place of the last distractor, and leaves the options otherwise", async () => {
    const { adaptOptions } = await import("./machine.js");
    const options = ["Rejected (409)", "Reserved; stock -1", "Not found (404)", "Reserved; stock stays 0"];
    expect(adaptOptions(options, [0, 1], "Reserved; stock 5")).toEqual(["Rejected (409)", "Reserved; stock -1", "Not found (404)", "Reserved; stock 5"]);
    expect(adaptOptions(options, [0, 3], "It throws")).toEqual(["Rejected (409)", "Reserved; stock -1", "It throws", "Reserved; stock stays 0"]);
    expect(adaptOptions(options, [0, 1], "Reserved; stock stays 0")).toEqual(options);
    expect(adaptOptions(options, [0, 1], "? unknown")).toEqual(options);
    expect(adaptOptions(options, [0, 1], null)).toEqual(options);
  });
});
