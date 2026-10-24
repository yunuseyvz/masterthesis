import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Capture, assistantCount, parseChunks, threadKey } from "@beacon/shared";
import { fakeModel } from "./fake-model.js";
import { proposeSteps } from "./inspect.js";
import { record } from "./record.js";
import { synthesize } from "./synthesize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const seed = path.join(root, "capture-tool/seeds/shopfront");

describe("capture format", () => {
  it("keys threads by their first real message, independent of the project's path", () => {
    const body = (dir: string, extra: object[] = []) => ({
      tools: [{}],
      messages: [{ role: "system", content: `cwd ${dir}` }, { role: "user", content: "<system-reminder>Plan mode</system-reminder>" }, { role: "user", content: `Fix ${dir}/a.ts` }, ...extra],
    });
    expect(threadKey(body("/tmp/a"), "/tmp/a")).toBe(threadKey(body("/work/b"), "/work/b"));
    expect(threadKey(body("/tmp/a", [{ role: "assistant", content: "ok" }]), "/tmp/a")).toBe(threadKey(body("/tmp/a"), "/tmp/a"));
    expect(threadKey({ messages: body("/tmp/a").messages }, "/tmp/a")).not.toBe(threadKey(body("/tmp/a"), "/tmp/a")); // side request
  });

  it("counts the assistant messages a request carries, without injected or empty ones", () => {
    const messages = [{ role: "user", content: "x" }, { role: "assistant", content: "a" }, { role: "assistant", content: "", tool_calls: [{}] }, { role: "assistant", content: "" }, { role: "assistant", content: "PAUSE" }];
    expect(assistantCount({ messages })).toBe(3);
    expect(assistantCount({ messages }, ["PAUSE"])).toBe(2);
  });

  it("reassembles text and tool calls from streamed chunks", () => {
    const ev = (delta: object, finish: string | null = null) => JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] });
    const r = parseChunks([
      { t: 0, data: ev({ content: "Hel" }) },
      { t: 1, data: ev({ content: "lo" }) },
      { t: 2, data: ev({ tool_calls: [{ index: 0, id: "c", function: { name: "write", arguments: '{"pa' } }] }) },
      { t: 3, data: ev({ tool_calls: [{ index: 0, function: { arguments: 'th":"a"}' } }] }, "tool_calls") },
      { t: 4, data: "[DONE]" },
    ]);
    expect(r).toEqual({ text: "Hello", tools: [{ id: "c", name: "write", args: '{"path":"a"}' }], finish: "tool_calls" });
  });
});

describe("synthetic captures", () => {
  it.each(["US0", "US1", "US2", "US3", "US4", "US5", "US6"])("captures/%s is what synthesize makes from capture-tool/synthetic", (id) => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "synth-"));
    const fresh = synthesize(path.join(root, "capture-tool/synthetic", id), seed, out).capture;
    const stored = Capture.parse(JSON.parse(fs.readFileSync(path.join(root, "captures", id, "capture.json"), "utf8")));
    // Snapshot ids carry commit times; everything the replay plays must be identical.
    const strip = (c: Capture) => ({ ...c, createdAt: "", workspace: { ...c.workspace, initial: "", final: "" }, calls: c.calls.map((x) => ({ ...x, snapshot: "" })) });
    expect(strip(fresh)).toEqual(strip(stored));
  });
});

describe.skipIf(process.env.OPENCODE_IT !== "1")("recording a real opencode session", () => {
  it("records every model response with its timing, the turns, and the project before each response", async () => {
    const model = await fakeModel();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rec-"));
    try {
      const capture = await record({
        id: "hello",
        seed,
        out,
        model: "fake",
        upstream: model.url,
        bin: path.join(root, "node_modules/.bin/opencode"),
        turns: [{ text: "Create hello.txt saying hi.", agent: "build" }],
        brief: "Always greet in lowercase. BRIEF-MARKER-7",
        log: () => {},
      });
      expect(capture.turns.map((t) => t.text)).toEqual(["Create hello.txt saying hi."]);
      const main = capture.calls.filter((c) => c.thread === capture.mainThread);
      expect(main.map((c) => c.position)).toEqual([0, 1]);
      // The brief reached the model with every request (opencode's global AGENTS.md), and the capture keeps it.
      const withTools = model.requests.filter((r) => JSON.parse(r).tools?.length);
      expect(withTools.length).toBe(2);
      for (const r of withTools) expect(r).toContain("BRIEF-MARKER-7");
      expect(capture.brief).toContain("BRIEF-MARKER-7");
      expect(parseChunks(main[0]!.chunks).tools[0]!.name).toBe("write");
      expect(parseChunks(main[1]!.chunks).text).toBe("Done.");
      expect(main[0]!.chunks.at(-1)!.t).toBeGreaterThanOrEqual(140); // the model's own pause is in the recording
      // The project: no hello.txt when the first response was requested, there when the second was.
      const git = path.join(out, "check.git");
      execFileSync("git", ["clone", "-q", "--bare", path.join(out, "history.bundle"), git]);
      const show = (commit: string) => {
        try {
          return execFileSync("git", [`--git-dir=${git}`, "show", `${commit}:hello.txt`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch {
          return null;
        }
      };
      expect(show(main[0]!.snapshot)).toBeNull();
      expect(show(main[1]!.snapshot)).toBe("hi\n");
      expect(show(capture.workspace.final)).toBe("hi\n");
    } finally {
      model.close();
    }
  }, 120_000);
});

describe("inspect", () => {
  it("proposes step starts from the agent's Step N sentences and flags two steps in one response", () => {
    const lines = proposeSteps([
      { position: 6, text: "Step 1: Add the stock field." },
      { position: 7, text: "" },
      { position: 8, text: "Step 2: Implement the report.\n" },
      { position: 9, text: "Step 3: Wire it up.\nStep 4: Add tests." },
    ]);
    expect(lines).toContain(`  { "n": 1, "kind": "?", "summary": "Add the stock field", "start": 6 },`);
    expect(lines).toContain(`  { "n": 4, "kind": "?", "summary": "Add tests", "start": 9 },`);
    expect(lines.some((l) => l.includes("@9 announces steps 3, 4"))).toBe(true);
    expect(lines.some((l) => l.includes("out of order"))).toBe(true); // 3 and 4 share a start
  });
});
