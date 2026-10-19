import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateSessionPlan } from "@beacon/shared";
import { buildApp } from "./app.js";
import { loadStory, makeStoryLoader } from "./corpus.js";
import { checkpointsFor, stepsOf } from "./checkpoints.js";
import { StudySession } from "./machine.js";
import { runProbe, runTests } from "./runner.js";

const corpusDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../corpus");

const PRESURVEY = {
  type: "presurvey",
  consent: true,
  demographics: { ageGroup: "25-34", programmingYears: "3-5", aiAssistantUse: "weekly", codeReviewFrequency: "weekly", tsFamiliarity: 4 },
  ncs: [4, 3, 2, 2, 5, 4],
  attention: 4,
  stias: [5, 5, 4],
};

const POSTSURVEY = {
  type: "postsurvey",
  tlx: { mental: 60, physical: 5, temporal: 40, performance: 25, effort: 55, frustration: 30 },
  paas: 6,
  ranking: ["CHECKPOINT", "BATCH"],
  comment: "fine",
};

/** begin -> presurvey -> first checkpoint */
async function startSession(session: StudySession) {
  await session.act({ type: "begin" });
  await session.act(PRESURVEY);
}

describe.each(["US0", "US1", "US2", "US3", "US4", "US5", "US6"])("%s corpus", (id) => {
  const story = loadStory(corpusDir, id);
  const flawedDiffers = id !== "US0";

  it("Correct variant: happy-path tests pass and the boundary behaviour is right", async () => {
    const ws = story.testWorkspace("Correct");
    const r = await runTests(ws, story.def.testFile);
    expect(r.passed).toBe(3);
    expect(r.failed).toBe(0);
    expect(await runProbe(ws, story.probeScript())).toBe(story.def.probe.expected.Correct);
  });

  it("Flawed variant: same tests still pass, but the boundary behaviour diverges", async () => {
    const ws = story.testWorkspace("Flawed");
    const r = await runTests(ws, story.def.testFile);
    expect(r.passed).toBe(3);
    expect(r.failed).toBe(0);
    expect(await runProbe(ws, story.probeScript())).toBe(story.def.probe.expected.Flawed);
    if (flawedDiffers) expect(story.def.probe.expected.Flawed).not.toBe(story.def.probe.expected.Correct);
  });

  it("probe options contain both expected answers and understanding answers are well-formed", () => {
    const { options, expected } = story.def.probe;
    expect(options).toContain(expected.Correct);
    expect(options).toContain(expected.Flawed);
    expect(new Set(options).size).toBe(4);
    const items = story.def.understanding.items;
    expect(items).toHaveLength(3);
    for (const it of items) {
      expect(new Set(it.options).size).toBe(4);
      expect(it.question).not.toBe(story.def.probe.question); // the understanding items must not repeat the stage-2 question
    }
    if (flawedDiffers) {
      expect(items.some((it) => it.correct.Correct !== it.correct.Flawed)).toBe(true); // at least one item depends on the defect
      expect(items.filter((it) => it.correct.Correct === it.correct.Flawed).length).toBeGreaterThanOrEqual(2); // and two do not
    }
  });

  it("understanding answers are what the code does, in both variants (verified by running it)", async () => {
    for (const v of ["Correct", "Flawed"] as const) {
      const out = await runProbe(story.projectWorkspace(v, 4), story.understandingScript());
      expect(out).not.toBeNull();
      expect(JSON.parse(out!)).toEqual(story.def.understanding.items.map((it) => it.options[it.correct[v]]));
    }
  });

  it("ships a neutral README that explains how to run the tests", () => {
    const readme = story.projectWorkspace("Flawed", 2).get("README.md");
    expect(readme).toBeDefined();
    expect(readme).toContain("npm test");
    expect(readme).toContain(story.def.project);
    expect(story.projectWorkspace("Correct", 2).get("README.md")).toBe(readme); // identical across variants
    expect(readme).not.toMatch(/flaw|defect|bug|correct|incorrect/i);
    for (const step of [1, 2, 3, 4]) expect(story.projectWorkspace("Correct", step).has("README.md")).toBe(true);
  });

  it("the milestone step is a short diff and the flawed variant differs only there", () => {
    const ms = story.milestoneStep;
    const diffs = story.diff("Flawed", ms, ms);
    expect(diffs.every((d) => d.before === "")).toBe(true);
    const lines = diffs.reduce((n, d) => n + d.after.split("\n").length, 0);
    expect(lines).toBeGreaterThanOrEqual(8);
    expect(lines).toBeLessThan(35);
    for (const n of [1, 2, 3, 4].filter((x) => x !== ms)) {
      expect(story.diff("Flawed", n, n)).toEqual(story.diff("Correct", n, n));
    }
  });

  it("base files exist before step 1 and are never part of a diff", () => {
    const story = loadStory(corpusDir, "US2");
    expect(story.workspaceAt("Correct", 0).has("src/lib/accounts.ts")).toBe(true);
    const touched = story.diff("Correct", 1, 4).map((d) => d.path);
    expect(touched).not.toContain("src/lib/accounts.ts");
  });
});

describe("Next.js route handlers", () => {
  it("the checkout route answers with the reservation result (Correct variant, all steps written)", async () => {
    const ws = loadStory(corpusDir, "US1").projectWorkspace("Correct", 4);
    const out = await runProbe(ws, `
      import { POST } from "./src/app/api/checkout/route.ts";
      const send = (body) => POST(new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify(body) }));
      const a = await send({ skuId: "mug", qty: 3 });
      const b = await send({ skuId: "nope", qty: 1 });
      console.log(a.status, await a.text(), b.status);
    `);
    expect(out).toBe('200 {"ok":true,"remaining":17} 404');
  });

  it("the payments webhook route credits an account once and skips a redelivery", async () => {
    const ws = loadStory(corpusDir, "US2").projectWorkspace("Correct", 4);
    const out = await runProbe(ws, `
      import { POST } from "./src/app/api/webhooks/payments/route.ts";
      import { getDb } from "./src/lib/db.ts";
      const send = () => POST(new Request("http://localhost/api/webhooks/payments", { method: "POST", body: JSON.stringify({ id: "evt_1", type: "payment.succeeded", accountId: "acc_1", amountCents: 500 }) }));
      const a = await send();
      const b = await send();
      console.log(await a.text(), await b.text(), getDb().accounts.accounts.get("acc_1").balanceCents);
    `);
    expect(out).toBe("processed duplicate 500");
  });
});

describe("agent narration", () => {
  it.each(["US0", "US1", "US2", "US3", "US4", "US5", "US6"])("%s: every step has an agent text and the plan lists all four steps", (id) => {
    const story = loadStory(corpusDir, id);
    expect(story.def.steps).toHaveLength(4);
    for (const st of story.def.steps) expect((st.narration ?? "").length).toBeGreaterThan(20);
  });
});

describe("milestone position", () => {
  it("the milestone is at step 1, 2 and 3 in two stories each, so its position is no cue", () => {
    const positions = ["US1", "US2", "US3", "US4", "US5", "US6"].map((id) => loadStory(corpusDir, id).milestoneStep).sort();
    expect(positions).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("the checkpoint regime pauses after the story's own milestone step", () => {
    for (const ms of [1, 2, 3]) {
      const [cp] = checkpointsFor("CHECKPOINT", ms);
      expect(cp!.scored).toBe(true);
      expect(stepsOf(cp!)).toEqual([ms]);
    }
  });
});

describe("regimes", () => {

  it("each regime has exactly one scored pause, and it comes first; anything after it is an unscored wrap-up", () => {
    for (const r of ["BATCH", "CHECKPOINT"] as const) {
      const cps = checkpointsFor(r, 2);
      expect(cps.filter((c) => c.scored)).toHaveLength(1);
      expect(cps[0]!.scored).toBe(true);
      for (const c of cps.slice(1)) {
        expect(c.scored).toBe(false);
        expect(c.id).toBe("wrap-up");
      }
    }
  });

  it("every regime shows every agent step exactly once before the understanding questions", () => {
    for (const r of ["BATCH", "CHECKPOINT"] as const) {
      for (const ms of [1, 2, 3]) {
        const shown = checkpointsFor(r, ms).flatMap(stepsOf).sort();
        expect(shown).toEqual([1, 2, 3, 4]);
      }
    }
  });
});

describe("study flow", () => {
  it("runs presurvey, practice and six trials, exports, and never leaks variant to the client", async () => {
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-"));
    const app = buildApp({ participantId: "PT", studySeed: "42", group: 0, exportDir, corpusDir, exitOnFinish: false, sandbox: {} });
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();
    const flowPlan = generateSessionPlan({ participantId: "PT", studySeed: "42", group: 0 });

    expect(JSON.stringify((await app.inject({ url: "/api/study/state" })).json())).not.toMatch(/Flawed|variant|regime/);
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { type: "stage1", decision: "accept", scrollCoverage: 1 } })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: PRESURVEY })).statusCode).toBe(409); // before begin

    let view = await post("/api/study/action", { type: "begin" });
    expect(view.phase).toBe("presurvey");
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { ...PRESURVEY, consent: false } })).statusCode).toBe(400);
    view = await post("/api/study/action", PRESURVEY);

    for (let i = 0; i < 7; i++) {
      expect(view.trial).toBe(i + 1);
      expect(view.practice).toBe(i === 0);
      expect(view.phase).toBe("stage1");
      await post("/api/study/action", { type: "ready" });
      view = await post("/api/study/action", { type: "stage1", decision: "accept", scrollCoverage: 0.5 });
      expect(view.phase).toBe("stage2");
      expect(view.probe.options).toHaveLength(4);
      view = await post("/api/study/action", { type: "stage2", probeAnswer: 0, final: "confirm" });
      // Every regime but BATCH now shows the steps it has not shown yet, without a decision, before the questions.
      const regime = (i === 0 ? flowPlan.practice : flowPlan.trials[i - 1]!).regime;
      if (regime === "BATCH") {
        expect(view.phase).toBe("understanding");
      } else {
        expect(view.phase).toBe("unscored");
        expect(view.checkpoint.id).toBe("wrap-up");
        await post("/api/study/action", { type: "ready" });
        view = await post("/api/study/action", { type: "advance" });
      }
      expect(view.phase).toBe("understanding");
      expect(view.understanding.items).toHaveLength(3);
      for (const it of view.understanding.items) expect(it.options).toHaveLength(4);
      view = await post("/api/study/action", { type: "understanding", answers: [0, 0, 0], confidence: 4, mentalDemand: 3, frustration: 2 });
    }
    expect(view.phase).toBe("postsurvey");
    expect(view.sessions).toHaveLength(7);
    expect(new Set(view.sessions.map((x: { project: string }) => x.project)).size).toBe(1); // all stories live in the shared codebase
    expect((await app.inject({ method: "POST", url: "/api/study/finish" })).statusCode).toBe(409); // not before the post-survey
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { ...POSTSURVEY, ranking: ["BATCH", "BATCH"] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { ...POSTSURVEY, tlx: { ...POSTSURVEY.tlx, mental: 62 } } })).statusCode).toBe(400);
    view = await post("/api/study/action", POSTSURVEY);
    expect(view.phase).toBe("debrief");
    expect((await post("/api/study/finish")).ok).toBe(true);

    const bundle = JSON.parse(fs.readFileSync(path.join(exportDir, "PT_42.json"), "utf8"));
    expect(bundle.trials).toHaveLength(6); // practice is not among the measured trials
    expect(bundle.practice.story).toBe("US0");
    expect(bundle.survey.pre.scores.ncs6).toBeCloseTo((4 + 3 + 4 + 4 + 5 + 4) / 6); // items 3,4 reverse-keyed: 6-2=4
    expect(bundle.survey.pre.attentionCheckPassed).toBe(true);
    expect(bundle.survey.post.ranking).toEqual(["CHECKPOINT", "BATCH"]);
    expect(bundle.survey.post.scores.rawTlx).toBeCloseTo((60 + 5 + 40 + 25 + 55 + 30) / 6);
    expect(bundle.survey.post.paas).toBe(6);
    const csv = fs.readFileSync(path.join(exportDir, "trials.csv"), "utf8").trim().split("\n");
    expect(csv).toHaveLength(7);
    expect(csv[0]).toContain("understandingScore");
    expect(csv[0]).toContain("u1_answer,u1_correct,u2_answer,u2_correct,u3_answer,u3_correct");
    expect(bundle.trials[0].understandingAnswers).toHaveLength(3);
    expect(bundle.trials[0].understandingScore).toBe(bundle.trials[0].understandingCorrects.filter(Boolean).length);
    const jsonl = fs.readFileSync(path.join(exportDir, "PT_42.events.jsonl"), "utf8").trim().split("\n");
    expect(jsonl.length).toBe(bundle.events.length);
  });

  it("grades the probe by execution, not by option position", async () => {
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-"));
    const app = buildApp({ participantId: "PT2", studySeed: "7", group: 3, exportDir, corpusDir, exitOnFinish: false, sandbox: {} });
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();
    const readEvents = () => fs.readFileSync(path.join(exportDir, "PT2_7.events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

    await post("/api/study/action", { type: "begin" });
    let view = await post("/api/study/action", PRESURVEY);
    // practice trial (US0, Correct): answer with the displayed option that equals the true output
    view = await post("/api/study/action", { type: "stage1", decision: "accept", scrollCoverage: 1 });
    const idx = (view.probe.options as string[]).indexOf("Dear Ada,");
    await post("/api/study/action", { type: "stage2", probeAnswer: idx, final: "confirm" });
    const s2 = readEvents().find((e) => e.type === "stage2_submit").data;
    expect(s2.probeCorrect).toBe(true);
  });
});

describe("condition tag (experimenter aid)", () => {
  const plan = generateSessionPlan({ participantId: "TG", studySeed: "5", group: 2 });
  const mk = (show: boolean) => new StudySession(plan, makeStoryLoader(corpusDir), () => {}, Date.now, () => {}, show);
  const letter = { BATCH: "B", CHECKPOINT: "K" } as const;

  it("is absent by default, so participants cannot see their condition", async () => {
    const s = mk(false);
    await startSession(s);
    expect(s.view().debugTag).toBeUndefined();
    expect(JSON.stringify(s.view())).not.toMatch(/debugTag|Flawed|Correct|BATCH|CHECKPOINT/);
  });

  it("shows regime letter and variant letter for the current trial when enabled", async () => {
    const s = mk(true);
    expect(s.view().debugTag).toBeUndefined(); // no trial on screen yet
    await startSession(s);
    const t = plan.practice;
    expect(s.view().debugTag).toBe(`${letter[t.regime]}·${t.variant === "Flawed" ? "F" : "C"}`);
    expect(s.view().debugTag).toMatch(/^[BK]·[CF]$/);
  });
});

describe("ready handshake", () => {
  it("excludes the agent-replay time from stage-1 dwell", async () => {
    let t = 1000;
    const plan = generateSessionPlan({ participantId: "PT3", studySeed: "9", group: 0 });
    const session = new StudySession(plan, makeStoryLoader(corpusDir), () => {}, () => t);
    await startSession(session);
    t += 2500; // replay animation
    await session.act({ type: "ready" });
    await session.act({ type: "ready" }); // idempotent
    t += 4000; // participant reviews
    await session.act({ type: "stage1", decision: "accept", scrollCoverage: 1 });
    const ev = session.events.find((e) => e.type === "stage1_submit")!.data as { dwellMs: number };
    expect(ev.dwellMs).toBe(4000);
  });
});

describe("terminal", () => {
  it("is a real shell with npm test prefilled; running it works and is counted", async () => {
    const { TerminalManager } = await import("./terminal.js");
    const plan = generateSessionPlan({ participantId: "PT4", studySeed: "3", group: 1 });
    const events: { type: string; data: any }[] = [];
    const session = new StudySession(plan, makeStoryLoader(corpusDir), (e) => events.push(e));
    const tm = new TerminalManager(session, {}, fs.mkdtempSync(path.join(os.tmpdir(), "sb-")));
    expect(tm.open({ cols: 100, rows: 30 }, () => {}, () => {})).toBeNull(); // nothing on screen yet

    await startSession(session);
    await session.act({ type: "ready" });

    let out = "";
    const strip = (x: string) => x.replace(/\x1b\[[0-9?;]*[A-Za-z]/g, "");
    const conn = tm.open({ cols: 100, rows: 30 }, (d) => (out += d), () => {})!;
    expect(conn).not.toBeNull();
    const prompt = /shopfront \$ npm test/; // shared project
    for (let i = 0; i < 50 && !prompt.test(strip(out)); i++) await new Promise((r) => setTimeout(r, 100));
    expect(strip(out)).toMatch(prompt); // prefilled, not run
    expect(out).not.toMatch(/pass\s+20/);
    conn.write("\r");
    for (let i = 0; i < 100 && !/pass\s+20/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    expect(out).toMatch(/pass\s+20/);
    expect(events.filter((e) => e.type === "terminal_command").map((e) => e.data.line)).toEqual(["npm test"]);
    tm.dispose();
  }, 20000);
});
