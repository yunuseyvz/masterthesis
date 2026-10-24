import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { capturesDir, trialsDir } from "./test-paths.js";
import { loadStory } from "./trial.js";

// Runs one trial against the real opencode v2 binary (slow; needs it installed). Enable with OPENCODE_IT=1.
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(here, "../../../node_modules/.bin/opencode");

describe.skipIf(process.env.OPENCODE_IT !== "1")("opencode integration", () => {
  it("plays the practice trial through real opencode: plan, pause, finish", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oc-it-"));
    const app = await buildApp({
      participantId: "IT",
      studySeed: "3",
      group: 0,
      trialsDir,
      capturesDir,
      exportDir: path.join(tmp, "exports"),
      workRoot: path.join(tmp, "work"),
      exitOnFinish: false,
      sandbox: {},
      agent: { kind: "opencode", bin, port: 4691, replayPort: 4690, home: path.join(tmp, "home") },
    });
    try {
      const post = async (payload: unknown) => (await app.inject({ method: "POST", url: "/_study/action", payload: payload as object })).json();
      // The study server forwards opencode's API on the same origin, adding opencode's password itself.
      const info = await app.inject({ url: "/api/info" });
      expect(info.statusCode).toBe(200);
      expect(info.json().version).toMatch(/^2\./);

      await post({ type: "begin" });
      let view = await post({ type: "presurvey", consent: true, demographics: { ageGroup: "25-34", programmingYears: "3-5", aiAssistantUse: "weekly", codeReviewFrequency: "weekly", tsFamiliarity: 4 }, ncs: [4, 3, 2, 2, 5, 4], attention: 4, stias: [5, 5, 4] });
      expect(view.phase).toBe("plan");
      expect(view.agentSessionId).toMatch(/^ses_/);

      const story = loadStory(trialsDir, capturesDir, "US0"); // practice: milestone pause after step 2
      const dir = path.join(tmp, "work", "IT", "00-US0");
      const paths = story.diff("Correct", 1, 4).map((d) => d.path);
      // Every file the agent writes or edits is exactly as the capture has it after step `upTo`.
      const expectFilesAt = (upTo: number) => {
        const expected = story.workspaceAt("Correct", upTo);
        for (const p of paths) {
          const disk = path.join(dir, p);
          expect(fs.existsSync(disk) ? fs.readFileSync(disk, "utf8") : undefined, p).toBe(expected.get(p));
        }
      };
      view = await post({ type: "approvePlan" });
      expect(view.phase).toBe("stage1");
      expectFilesAt(2);

      view = await post({ type: "stage1", decision: "accept" });
      view = await post({ type: "stage2", probeAnswer: 0, final: "confirm" });
      expect(view.phase).toBe("reviewing");
      expectFilesAt(4);
    } finally {
      await app.close();
    }
  }, 120_000);
});
