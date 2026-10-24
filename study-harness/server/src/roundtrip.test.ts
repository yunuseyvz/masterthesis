import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fakeModel } from "../../../capture-tool/src/fake-model.js";
import { record } from "../../../capture-tool/src/record.js";
import { OpencodeHost } from "./agent.js";
import { loadCapture } from "./captures.js";
import { ReplayEndpoint } from "./replay.js";
import { createTrialWorkspace } from "./workspace.js";

// Records a session with the capture tool, then replays the capture through real opencode (slow; OPENCODE_IT=1).
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const bin = path.join(root, "node_modules/.bin/opencode");

describe.skipIf(process.env.OPENCODE_IT !== "1")("capture → replay roundtrip", () => {
  it("a recorded session replays 1:1 in a new project folder, with its timing", async () => {
    const model = await fakeModel();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "roundtrip-"));
    const out = path.join(tmp, "capture");
    try {
      await record({ id: "hello", seed: path.join(root, "capture-tool/seeds/shopfront"), out, model: "fake", upstream: model.url, bin, turns: [{ text: "Create hello.txt saying hi.", agent: "build" }], log: () => {} });
    } finally {
      model.close();
    }
    const loaded = loadCapture(out);
    const events: { type: string; data: unknown }[] = [];
    const log = (type: string, data: unknown) => events.push({ type, data });
    const replay = new ReplayEndpoint(log, 1);
    await replay.listen(4694);
    const host = await new OpencodeHost({ bin, port: 4695, replayUrl: "http://127.0.0.1:4694/v1", home: path.join(tmp, "home"), sandbox: {}, log }).start();
    try {
      const dir = createTrialWorkspace(path.join(tmp, "work"), "01-hello", loaded.files(loaded.capture.workspace.initial), {});
      replay.load({ capture: loaded, workspaceDir: dir, patches: [], stops: [] });
      const turn = loaded.capture.turns[0]!;
      const { id } = await host.startSession({ dir, title: "hello", agent: turn.agent ?? "build" });
      replay.arm();
      const started = Date.now();
      await host.runTurn(id, turn.text, turn.agent);
      expect(fs.readFileSync(path.join(dir, "hello.txt"), "utf8")).toBe("hi\n");
      const served = events.filter((e) => e.type === "replay_call").map((e) => (e.data as { thread: string; position: number }));
      expect(served.filter((s) => s.thread === "main").map((s) => s.position)).toEqual([0, 1]);
      // The recorded model took ≥150 ms per response; the replay takes as long.
      expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    } finally {
      host.close();
      replay.close();
    }
  }, 180_000);
});
