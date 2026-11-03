import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { changedLines } from "./lines.js";
import { loadReference } from "./reference.js";
import { runProbe, runTests } from "./runner.js";
import { projectDir, trialsDir } from "./test-paths.js";
import { loadStory } from "./trial.js";

const load = (id: string) => loadStory(trialsDir, projectDir, id);
const ALL = ["US0", "US1", "US2", "US3", "US4", "US5", "US6"];

// The questions are checked against each story's reference implementation (see reference.ts): the code the step
// outline describes, per variant.
describe.each(ALL)("trial %s", (id) => {
  const story = load(id);
  const ref = loadReference(story);
  const flawedDiffers = id !== "US0";

  it("the reference has the flaw exactly from the flaw step on (a Flawed folder of its own there)", () => {
    const own = [1, 2, 3, 4].filter((n) => fs.existsSync(path.join(story.dir, "reference", "Flawed", `step${n}`)));
    if (story.flawStep === null) expect(own).toEqual([]);
    else {
      expect(own[0]).toBe(story.flawStep);
      expect(ref.step("Flawed", story.flawStep)).not.toEqual(ref.step("Correct", story.flawStep));
    }
  });

  // The agent writes its tests after the flaw and may catch it (then it fixes the code), so only the Correct
  // variant must pass them.
  it("the visible tests pass in the Correct variant", async () => {
    const r = await runTests(ref.workspaceAt("Correct", 4), story.def.testFile);
    expect(r.passed).toBe(r.tests.length);
    expect(r.passed).toBeGreaterThan(0);
    expect(r.failed).toBe(0);
  });

  // The behaviour question is graded when it is asked: after a pause, only the steps up to the paused one exist.
  it("each probe prints its expected answer on the code after its own step and on the finished code, in both variants", async () => {
    for (const probe of story.def.probes) {
      for (const v of ["Correct", "Flawed"] as const) {
        expect(await runProbe(ref.workspaceAt(v, probe.step), story.probeScript(probe)), `probe ${probe.step} ${v}`).toBe(probe.expected[v]);
        expect(await runProbe(ref.workspaceAt(v, 4), story.probeScript(probe)), `probe ${probe.step} ${v}, finished`).toBe(probe.expected[v]);
      }
      expect(probe.expected.Correct !== probe.expected.Flawed).toBe(probe.step === story.flawStep);
    }
  });

  it("probe options contain both expected answers and understanding answers are well-formed", () => {
    for (const { options, expected } of story.def.probes) {
      expect(options).toContain(expected.Correct);
      expect(options).toContain(expected.Flawed);
      expect(new Set(options).size).toBe(4);
    }
    const items = story.def.understanding.items;
    const probeQuestions = story.def.probes.map((p) => p.question);
    for (const it of items) {
      expect(new Set(it.options).size).toBe(4);
      expect(probeQuestions).not.toContain(it.question); // the understanding items must not repeat a stage-2 question
    }
    // exactly the item about the flaw step depends on the defect
    if (flawedDiffers) for (const it of items) expect(it.correct.Correct !== it.correct.Flawed).toBe(it.step === story.flawStep);
  });

  it("understanding answers are what the code does, in both variants (verified by running it)", async () => {
    for (const v of ["Correct", "Flawed"] as const) {
      const out = await runProbe(ref.workspaceAt(v, 4), story.understandingScript(), 60_000);
      expect(out).not.toBeNull();
      expect(JSON.parse(out!)).toEqual(story.def.understanding.items.map((it) => it.options[it.correct[v]]));
    }
  });

  it("the project's README explains how to run the tests and never hints at the defect", () => {
    for (const step of [0, 1, 2, 3, 4]) {
      const readme = ref.workspaceAt("Flawed", step).get("README.md");
      expect(readme).toContain("npm test");
      expect(ref.workspaceAt("Correct", step).get("README.md")).toBe(readme); // identical across variants
      expect(readme).not.toMatch(/flaw|defect|bug|incorrect/i);
    }
  });

  it("the steps a pause can follow are of similar size, and the variants differ only in the flaw step", () => {
    // Changed lines per step; a pause after a much larger step would review more code than one after a small step.
    const changed = (n: number) => ref.diff("Correct", n, n).reduce((sum, d) => sum + changedLines(d.before, d.after).length, 0);
    const sizes = [1, 2, 3].map(changed);
    expect(changed(story.milestoneStep)).toBeGreaterThanOrEqual(8);
    if (ALL.slice(1).includes(id)) expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThanOrEqual(3);
    // A later step may edit the file with the flaw, so compare what each step changes, not the whole files.
    for (const n of [1, 2, 3, 4].filter((x) => x !== story.flawStep)) expect(ref.hunks("Flawed", n, n)).toEqual(ref.hunks("Correct", n, n));
    if (flawedDiffers) expect(ref.diff("Flawed", story.flawStep!, story.flawStep!)).not.toEqual(ref.diff("Correct", story.flawStep!, story.flawStep!));
  });

  it("the agent changes existing files of the codebase as well as adding new ones", () => {
    const diff = ref.diff("Correct", 1, 4);
    expect(diff.some((d) => d.before === "")).toBe(true);
    expect(diff.some((d) => d.before !== "" && d.path === "README.md")).toBe(true);
  });

  it("every step does something to the project", () => {
    for (const n of [1, 2, 3, 4]) expect(ref.diff("Correct", n, n).length).toBeGreaterThan(0);
  });
});

describe("Next.js route handlers", () => {
  it("the checkout route answers with the reservation result (Correct variant, all steps written)", async () => {
    const out = await runProbe(loadReference(load("US1")).workspaceAt("Correct", 4), `
      import { POST } from "./src/app/api/checkout/route.ts";
      const send = (body) => POST(new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify(body) }));
      const a = await send({ sku: "mug", quantity: 2 });
      const b = await send({ sku: "nope", quantity: 1 });
      console.log(a.status, await a.text(), b.status);
    `);
    expect(out).toBe('200 {"ok":true,"sku":"mug","quantity":2,"remaining":1} 404');
  });

  it("the payments webhook route credits an account once and skips a redelivery", async () => {
    const out = await runProbe(loadReference(load("US2")).workspaceAt("Correct", 4), `
      import { POST } from "./src/app/api/webhooks/payments/route.ts";
      import { getDb } from "./src/lib/db.ts";
      const send = () => POST(new Request("http://localhost/api/webhooks/payments", { method: "POST", body: JSON.stringify({ id: "evt_1", type: "payment.succeeded", accountId: "acc_1", amount: "5.00" }) }));
      const a = await send();
      const b = await send();
      console.log(await a.text(), await b.text(), getDb().accounts.accounts.get("acc_1").balanceCents);
    `);
    expect(out).toBe('{"ok":true,"duplicate":false,"balanceCents":500} {"ok":true,"duplicate":true} 500');
  });
});

describe("milestone and flaw position", () => {
  const measured = ALL.slice(1).map(load);

  it("the milestone is at step 1, 2 and 3 in two stories each, so its position is no cue", () => {
    expect(measured.map((s) => s.milestoneStep).sort()).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("the flaw sits in the milestone step in three stories and in a non-milestone step in the other three", () => {
    expect(measured.filter((s) => s.flawStep === s.milestoneStep)).toHaveLength(3);
    expect(measured.filter((s) => s.flawStep !== null && s.flawStep !== s.milestoneStep)).toHaveLength(3);
  });

  it("MILESTONE pauses after the milestone, NON_MILESTONE after one of the two other steps among 1-3", () => {
    for (const s of measured) {
      expect(s.pauseStep("MILESTONE", 0)).toBe(s.milestoneStep);
      expect(s.pauseStep("BATCH", 0)).toBe(4);
      expect([s.pauseStep("NON_MILESTONE", 0), s.pauseStep("NON_MILESTONE", 1)].sort()).toEqual([1, 2, 3].filter((n) => n !== s.milestoneStep));
    }
  });

  it("BATCH asks about the flaw step; a pause asks about the step it follows", () => {
    for (const s of measured) {
      expect(s.probeFor("BATCH", 4).step).toBe(s.flawStep);
      for (const n of [1, 2, 3]) expect(s.probeFor("NON_MILESTONE", n).step).toBe(n);
    }
  });
});
