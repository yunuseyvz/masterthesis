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
    const call = (step: number) => rpc(port, { id: step, method: "tools/call", params: { name: "checkpoint", arguments: { step } } });
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
    const live = new LiveEndpoint({ upstream: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`, apiKey: "secret", model: "study-model", log: (type, data) => logs.push({ type, data }) });
    const port = await live.listen(0);
    closers.push(() => live.close());
    const request = "As a shopper, I want a coupon.";
    live.load({ workspaceDir: "/work/x", mainThread: threadKey({ messages: [{ role: "user", content: request }], tools: [{}] }, "/work/x"), drehbuch: "SCRIPT" });
    const post = (body: object) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer live" }, body: JSON.stringify({ stream: true, model: "study-model", ...body }) }).then((r) => r.text());
    await post({ messages: [{ role: "system", content: "base" }, { role: "user", content: request }], tools: [{ type: "function", function: { name: "write" } }] });
    await post({ messages: [{ role: "system", content: "title" }, { role: "user", content: request }] });
    expect(seen.map((s) => s.system)).toEqual(["base\n\nSCRIPT", "title"]);
    expect(seen[0]!.auth).toBe("Bearer secret");
    expect(live.calls()).toHaveLength(2);
    expect(logs.filter((l) => l.type === "live_call").map((l) => [l.data.thread, l.data.usage])).toEqual([["main", { prompt: 10, completion: 2, cached: undefined }], [expect.stringMatching(/^n:/), { prompt: 10, completion: 2, cached: undefined }]]);
  });

  /** An upstream that plays `answers` in order: text, tool calls, or a status; every event carries reasoning. */
  async function planSetup(answers: ({ text: string } | { tool: string; text?: string } | { status: number } | { hang: true })[], load: { planDeadlineMs?: number } = {}) {
    const seen: { messages: { role: string; content: string; reasoning_content?: string; tool_calls?: unknown[] }[] }[] = [];
    const upstream = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (d) => (raw += d));
      req.on("end", () => {
        seen.push(JSON.parse(raw));
        const a = answers[seen.length - 1] ?? { text: "built" };
        if ("hang" in a) return;
        if ("status" in a) return void res.writeHead(a.status, { "content-type": "application/json" }).end('{"error":{"message":"overloaded"}}');
        const ev = (delta: object, finish: string | null = null, usage?: object) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }], ...(usage ? { usage } : {}) })}\n\n`;
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(ev({ reasoning_content: `SECRET-THOUGHT ${seen.length}` }));
        if (a.text) res.write(ev({ content: a.text }));
        if ("tool" in a) res.write(ev({ tool_calls: [{ index: 0, id: a.tool, type: "function", function: { name: "read", arguments: "{}" } }] }));
        res.write(ev({}, "tool" in a ? "tool_calls" : "stop", { prompt_tokens: 7, completion_tokens: 3 }));
        res.end("data: [DONE]\n\n");
      });
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    closers.push(() => upstream.close());
    const logs: { type: string; data: any }[] = [];
    const live = new LiveEndpoint({ upstream: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`, model: "m", log: (type, data) => logs.push({ type, data }) });
    const port = await live.listen(0);
    closers.push(() => live.close());
    const request = "As a shopper, I want a coupon.";
    live.load({ workspaceDir: "/w", mainThread: threadKey({ messages: [{ role: "user", content: request }], tools: [{}] }, "/w"), drehbuch: "SECRET-PLAN", publicPlan: "THE PUBLIC PLAN", leaks: ["sold.out"], steps: ["Add the types", "Add the reservation"], ...load });
    const post = async (messages: object[] = []) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: "POST", body: JSON.stringify({ model: "m", stream: true, tools: [{ function: { name: "read" } }], messages: [{ role: "system", content: "base" }, { role: "user", content: request }, ...messages] }) });
      return { status: res.status, text: await res.text() };
    };
    return { post, seen, logs, live };
  }
  const content = (sse: string) => sse.split("\n\n").filter((f) => f.startsWith("data: {")).map((f) => JSON.parse(f.slice(6)).choices?.[0]?.delta?.content ?? "").join("");

  it("shows the public plan in place of the model's, lets the exploring through without text, and then gets out of the way", async () => {
    const { post, seen, logs, live } = await planSetup([
      { tool: "call_1", text: "Per the outline I will look around." },
      { text: "My plan: delete sold-out items." },
      { tool: "call_2", text: "Step 1: types." },
      { tool: "call_3", text: "Step 2: reserve stock and delete sold-out items." },
      { text: "All four steps are done. Sold-out items are gone now. The tests pass." },
      { text: "Sold-out items go." },
    ]);
    const explore = await post();
    expect(explore.text).toContain("call_1");
    expect(content(explore.text)).toBe("");
    const plan = await post();
    expect(content(plan.text)).toBe("THE PUBLIC PLAN");
    expect(plan.text).toContain('"finish_reason":"stop"');
    expect(plan.text).toContain('"prompt_tokens":7');
    expect(plan.text).toContain("[DONE]");
    expect(logs.find((l) => l.type === "live_plan_public")!.data).toMatchObject({ reason: "the model's plan", draft: "My plan: delete sold-out items." });
    expect(seen[1]!.messages[0]!.content).toContain("SECRET-PLAN");

    // opencode may ask again before the approval: an empty answer, and the model is not asked.
    const again = await post();
    expect(content(again.text)).toBe("");
    expect(again.text).toContain('"finish_reason":"stop"');
    expect(seen).toHaveLength(2);
    expect(logs.filter((l) => l.type === "live_plan_public")).toHaveLength(1);

    // After the approval the model's text reaches opencode as written, unless it gives a decision away: then a step's
    // announcement becomes the step's summary, and other text loses the sentences that do.
    live.endPlanning();
    expect(content((await post()).text)).toBe("Step 1: types.");
    const step2 = await post();
    expect(content(step2.text)).toBe("Step 2: Add the reservation.");
    expect(step2.text.indexOf("Add the reservation")).toBeLessThan(step2.text.indexOf("call_3")); // the text still comes before the tool call
    expect(step2.text).not.toContain("sold-out");
    expect(content((await post()).text)).toBe("All four steps are done. The tests pass.");
    expect(content((await post()).text)).toBe("Done.");
    expect(logs.filter((l) => l.type === "live_text_leak").map((l) => [l.data.found, l.data.replaced, l.data.shown])).toEqual([
      [["sold-out"], true, "Step 2: Add the reservation."],
      [["Sold-out"], true, "All four steps are done. The tests pass."],
      [["Sold-out"], true, "Done."],
    ]);
  });

  it("does not wait for a model that is overloaded or too slow", async () => {
    const overloaded = await planSetup([{ status: 429 }]);
    expect(content((await overloaded.post()).text)).toBe("THE PUBLIC PLAN");
    expect(overloaded.logs.find((l) => l.type === "live_plan_public")!.data.reason).toBe("status 429");

    const slow = await planSetup([{ hang: true }], { planDeadlineMs: 100 });
    const started = Date.now();
    expect(content((await slow.post()).text)).toBe("THE PUBLIC PLAN");
    expect(Date.now() - started).toBeLessThan(2000);
    expect(slow.logs.find((l) => l.type === "live_plan_public")!.data.reason).toBe("deadline");

    const late = await planSetup([], { planDeadlineMs: 0 });
    expect(content((await late.post()).text)).toBe("THE PUBLIC PLAN");
    expect(late.seen).toHaveLength(0);
  });

  it("keeps the model's reasoning from opencode, and gives it back to the model with its tool call", async () => {
    const { post, seen, live } = await planSetup([{ tool: "call_1" }, { text: "plan" }, { tool: "call_2" }]);
    const first = await post();
    expect(first.text).not.toContain("SECRET-THOUGHT");
    expect((await post([{ role: "assistant", content: "", tool_calls: [{ id: "call_1" }] }, { role: "tool", tool_call_id: "call_1", content: "x" }])).text).not.toContain("SECRET-THOUGHT");
    expect(seen[1]!.messages.find((m) => m.role === "assistant")!.reasoning_content).toBe("SECRET-THOUGHT 1");
    live.endPlanning();
    expect((await post()).text).not.toContain("SECRET-THOUGHT"); // while streaming, past the plan
  });

  it("sends only chat completions for the study's model upstream, and logs everything it refuses", async () => {
    const seen: string[] = [];
    const upstream = http.createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      req.resume();
      req.on("end", () => res.writeHead(200, { "content-type": "application/json" }).end("{}"));
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    closers.push(() => upstream.close());
    const logs: { type: string; data: any }[] = [];
    const live = new LiveEndpoint({ upstream: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`, apiKey: "secret", model: "study-model", log: (type, data) => logs.push({ type, data }) });
    const port = await live.listen(0);
    closers.push(() => live.close());
    const url = (p: string) => `http://127.0.0.1:${port}${p}`;
    const chat = (body: string) => fetch(url("/v1/chat/completions"), { method: "POST", headers: { "content-type": "application/json" }, body });
    const allowed = JSON.stringify({ model: "study-model", messages: [] });

    expect((await chat(allowed)).status).toBe(403); // before a trial is loaded
    live.load({ workspaceDir: "/work/x", mainThread: "main", drehbuch: "SCRIPT" });
    expect((await fetch(url("/v1/models"))).status).toBe(404);
    expect((await fetch(url("/v1/files"), { method: "POST", body: "{}" })).status).toBe(404);
    expect((await fetch(url("/v1/other/chat/completions"), { method: "POST", body: allowed })).status).toBe(404);
    expect((await fetch(url("/v1/chat/completions"))).status).toBe(404);
    expect((await chat(JSON.stringify({ model: "expensive-model", messages: [] }))).status).toBe(403);
    expect((await chat("not json")).status).toBe(400);
    expect(seen).toEqual([]);
    expect(live.calls()).toHaveLength(0);
    expect(logs.filter((l) => l.type === "live_refused").map((l) => l.data.reason)).toEqual(["no trial loaded", "not the chat endpoint", "not the chat endpoint", "not the chat endpoint", "not the chat endpoint", "another model", "not JSON"]);

    expect((await chat(allowed)).status).toBe(200);
    expect(seen).toEqual(["POST /v1/chat/completions"]);
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
