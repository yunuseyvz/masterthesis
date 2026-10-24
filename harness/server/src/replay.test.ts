import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseChunks, type Chunk } from "@beacon/shared";
import { FakeAgentHost } from "./agent.js";
import { IDLE_REPLY, PAUSE_TEXT, ReplayEndpoint, rewriteChunks } from "./replay.js";
import { loadStory, type Story } from "./trial.js";
import { capturesDir, trialsDir } from "./test-paths.js";

const story = loadStory(trialsDir, capturesDir, "US2"); // milestone step 3, flaw in step 2
const { capture } = story.capture;

/** Plays a trial through the fake agent: plan turn, approval turn, and (after a checkpoint) the rest. */
async function play(s: Story, variant: "Correct" | "Flawed", stops: number[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-"));
  for (const [p, c] of s.capture.files(s.capture.capture.workspace.initial)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), c);
  }
  const served: number[] = [];
  const replay = new ReplayEndpoint(() => {}, 0);
  replay.load({ capture: s.capture, workspaceDir: dir, patches: s.patches(variant), stops, onServe: (p) => served.push(p), filesAfter: (p) => s.filesAfter(variant, p) });
  const agent = new FakeAgentHost(replay);
  const { id } = await agent.startSession({ dir, title: "t", agent: "plan" });
  const turn = async (text: string) => {
    replay.arm();
    await agent.runTurn(id, text);
  };
  const disk = () => {
    const out = new Map<string, string>();
    const walk = (rel: string) => {
      for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(r);
        else out.set(r, fs.readFileSync(path.join(dir, r), "utf8"));
      }
    };
    walk("");
    return out;
  };
  return { replay, turn, disk, served, dir };
}

describe("replaying a capture", () => {
  it("BATCH plays the capture through and leaves the project as the captured session did", async () => {
    for (const v of ["Correct", "Flawed"] as const) {
      const p = await play(story, v, []);
      await p.turn(capture.turns[0]!.text);
      expect(p.served).toEqual([...Array(story.def.steps[0]!.start).keys()]); // the plan turn: exploration and plan
      await p.turn(capture.turns[1]!.text);
      expect(p.disk()).toEqual(story.workspaceAt(v, 4));
    }
  });

  it("a checkpoint stops before the next step's first response; resuming plays the rest", async () => {
    for (const pause of [1, 2, 3]) {
      const p = await play(story, "Flawed", [story.boundary(pause)!]);
      await p.turn(capture.turns[0]!.text);
      await p.turn(capture.turns[1]!.text);
      expect(p.disk()).toEqual(story.workspaceAt("Flawed", pause));
      await p.turn("Thanks, please continue.");
      expect(p.disk()).toEqual(story.workspaceAt("Flawed", 4));
      expect(new Set(p.served).size).toBe(p.served.length); // every response once
    }
  });

  it("answers outside a turn with the idle reply, opencode's reminders with silence, side requests neutrally", () => {
    const r = new ReplayEndpoint(() => {}, 0);
    r.load({ capture: story.capture, workspaceDir: "/w", patches: [], stops: [] });
    const first = { role: "user", content: capture.turns[0]!.text };
    expect(r.next({ messages: [first], tools: [{}] })).toEqual({ kind: "text", text: IDLE_REPLY });
    expect(r.next({ messages: [first, { role: "user", content: "<system-reminder>\nYou are in Plan mode." }], tools: [{}] })).toEqual({ kind: "text", text: "" });
    expect(r.next({ messages: [{ role: "user", content: "Generate a title" }] })).toEqual({ kind: "text", text: "Study session" });
    r.arm();
    const reply = r.next({ messages: [first], tools: [{}] });
    expect(reply.kind === "call" && reply.call.position).toBe(0);
    // A retry of the same request (same position) gets the same response.
    const again = r.next({ messages: [first], tools: [{}] });
    expect(again.kind === "call" && again.call.position).toBe(0);
  });

  it("the pause and idle texts do not count as recorded responses", () => {
    const r = new ReplayEndpoint(() => {}, 0);
    const stop = story.boundary(1)!;
    r.load({ capture: story.capture, workspaceDir: "/w", patches: [], stops: [stop] });
    const msgs = [{ role: "user", content: capture.turns[0]!.text }, ...Array.from({ length: stop }, () => ({ role: "assistant", content: "x" }))];
    r.arm();
    expect(r.next({ messages: msgs, tools: [{}] })).toEqual({ kind: "text", text: PAUSE_TEXT });
    r.arm();
    const reply = r.next({ messages: [...msgs, { role: "assistant", content: PAUSE_TEXT }, { role: "user", content: "continue" }], tools: [{}] });
    expect(reply.kind === "call" && reply.call.position).toBe(stop);
  });

  it("serves the variant's patched tool call", () => {
    const patch = story.patches("Flawed")[0]!;
    const r = new ReplayEndpoint(() => {}, 0);
    r.load({ capture: story.capture, workspaceDir: "/w", patches: story.patches("Flawed"), stops: [] });
    r.arm();
    const msgs = [{ role: "user", content: capture.turns[0]!.text }, ...Array.from({ length: patch.position }, () => ({ role: "assistant", content: "x" }))];
    const reply = r.next({ messages: msgs, tools: [{}] });
    if (reply.kind !== "call") throw new Error("expected a recorded call");
    const args = JSON.parse(parseChunks(reply.chunks).tools[patch.tool]!.args) as Record<string, string>;
    expect(Object.values(args).some((v) => v.includes(patch.replace))).toBe(true);
    expect(reply.chunks.length).toBe(reply.call.chunks.length); // same pieces, same timing
    expect(reply.chunks.map((c) => c.t)).toEqual(reply.call.chunks.map((c) => c.t));
  });
});

describe("rewriting recorded chunks", () => {
  const ev = (delta: object) => JSON.stringify({ choices: [{ index: 0, delta }] });

  it("moves the capture's project path to the trial's, even when it is split across chunks", () => {
    const args = JSON.stringify({ path: "/tmp/cap/x/src/a.ts", content: "see /tmp/cap/x" });
    const chunks: Chunk[] = [
      { t: 0, data: ev({ content: "Writing /tmp/c" }) },
      { t: 10, data: ev({ content: "ap/x/src/a.ts now" }) },
      { t: 20, data: ev({ tool_calls: [{ index: 0, id: "c1", function: { name: "write", arguments: args.slice(0, 15) } }] }) },
      { t: 30, data: ev({ tool_calls: [{ index: 0, function: { arguments: args.slice(15) } }] }) },
      { t: 40, data: "[DONE]" },
    ];
    const out = rewriteChunks(chunks, "/tmp/cap/x", "/work/P1/01-US1", []);
    const r = parseChunks(out);
    expect(r.text).toBe("Writing /work/P1/01-US1/src/a.ts now");
    expect(JSON.parse(r.tools[0]!.args)).toEqual({ path: "/work/P1/01-US1/src/a.ts", content: "see /work/P1/01-US1" });
    expect(out.map((c) => c.t)).toEqual(chunks.map((c) => c.t));
    expect(out.at(-1)!.data).toBe("[DONE]");
  });

  it("leaves chunks untouched when there is nothing to change", () => {
    const chunks: Chunk[] = [{ t: 5, data: ev({ content: "hello" }) }];
    expect(rewriteChunks(chunks, "/tmp/cap", "/work", [])).toEqual(chunks);
  });
});

describe("timing", () => {
  it("streams a recorded response with its recorded timing (scaled by the pace)", async () => {
    const r = new ReplayEndpoint(() => {}, 0.25);
    r.load({ capture: story.capture, workspaceDir: "/w", patches: [], stops: [] });
    await r.listen(4791);
    try {
      r.arm();
      const call = story.capture.main[0]!;
      const started = Date.now();
      const res = await fetch("http://127.0.0.1:4791/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ stream: true, tools: [{}], messages: [{ role: "user", content: capture.turns[0]!.text }] }),
      });
      const text = await res.text();
      const elapsed = Date.now() - started;
      expect(text.split("\n\n").filter(Boolean)).toHaveLength(call.chunks.length);
      const expected = call.chunks.at(-1)!.t * 0.25;
      expect(elapsed).toBeGreaterThanOrEqual(expected * 0.9);
      expect(elapsed).toBeLessThan(expected + 1000);
    } finally {
      r.close();
    }
  });
});
