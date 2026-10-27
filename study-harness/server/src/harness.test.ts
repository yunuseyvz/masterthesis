import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateSessionPlan } from "@beacon/shared";
import { buildApp } from "./app.js";
import { FakeAgentHost } from "./agent.js";
import { StudySession } from "./machine.js";
import { ReplayEndpoint } from "./replay.js";
import { capturesDir, trialsDir } from "./test-paths.js";
import { changedLines } from "./lines.js";
import { loadStory, makeStoryLoader } from "./trial.js";

const load = (id: string) => loadStory(trialsDir, capturesDir, id);

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
  ranking: ["PAUSE", "END"],
  comment: "fine",
};

const UNDERSTANDING = { type: "understanding", answers: [0, 0, 0, 0], confidences: [50, 70, 90, 100], paas: 6, itemMs: [4000, 3000, 5000, 2000], answerChanges: [0, 1, 0, 0] };

/** begin -> presurvey -> first checkpoint */
async function startSession(session: StudySession) {
  await session.act({ type: "begin" });
  await session.act(PRESURVEY);
}

const fakeConfig = (participantId: string, studySeed: string, group: number, extra: object = {}) => ({
  participantId, studySeed, group, trialsDir, capturesDir, exitOnFinish: false, sandbox: {},
  exportDir: fs.mkdtempSync(path.join(os.tmpdir(), "exp-")),
  workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")),
  agent: { kind: "fake" as const },
  ...extra,
});

describe("agent proxy", () => {
  it("refuses requests from the browser that would change the recorded session", async () => {
    const { isBlocked } = await import("./app.js");
    for (const [m, u] of [
      ["POST", "/api/session"],
      ["DELETE", "/api/session/ses_1"],
      ["POST", "/api/session/ses_1/prompt"],
      ["POST", "/api/session/ses_1/agent"],
      ["POST", "/api/session/ses_1/revert/stage"],
      ["DELETE", "/api/session/ses_1/revert"],
      ["POST", "/api/session/ses_1/fork"],
    ]) expect(isBlocked(m!, u!), `${m} ${u}`).toBe(true);
    for (const [m, u] of [
      ["GET", "/api/session/ses_1/message"],
      ["GET", "/api/event"],
      ["POST", "/api/pty"],
      ["DELETE", "/api/pty/p1"],
    ]) expect(isBlocked(m!, u!), `${m} ${u}`).toBe(false);
  });
});

describe("study flow", () => {
  it("runs presurvey, practice and six trials with the agent, exports, and never leaks variant to the client", async () => {
    const cfg = fakeConfig("PT", "42", 0);
    const app = await buildApp(cfg);
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();
    const flowPlan = generateSessionPlan({ participantId: "PT", studySeed: "42", group: 0 });

    expect(JSON.stringify((await app.inject({ url: "/_study/state" })).json())).not.toMatch(/Flawed|variant|regime/);
    expect((await app.inject({ method: "POST", url: "/_study/action", payload: { type: "stage1", decision: "accept" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: "/_study/action", payload: PRESURVEY })).statusCode).toBe(409); // before begin

    let view = await post("/_study/action", { type: "begin" });
    expect(view.phase).toBe("presurvey");
    expect((await app.inject({ method: "POST", url: "/_study/action", payload: { ...PRESURVEY, consent: false } })).statusCode).toBe(400);
    view = await post("/_study/action", PRESURVEY);

    for (let i = 0; i < 7; i++) {
      const t = i === 0 ? flowPlan.practice : flowPlan.trials[i - 1]!;
      const story = load(t.story);
      const trialDir = path.join(cfg.workRoot, "PT", `${String(t.position).padStart(2, "0")}-${t.story}`);
      expect(view.trial).toBe(i + 1);
      expect(view.practice).toBe(i === 0);
      expect(view.phase).toBe("plan");
      expect(view.story.plan).toHaveLength(4);
      // The project on disk, for every file the feature touches.
      const touched = story.diff(t.variant, 1, 4).map((d) => d.path);
      const expectAt = (step: number) => {
        const expected = story.workspaceAt(t.variant, step);
        for (const f of touched) {
          const disk = path.join(trialDir, f);
          expect(fs.existsSync(disk) ? fs.readFileSync(disk, "utf8") : undefined, f).toBe(expected.get(f));
        }
      };
      expectAt(0); // nothing written yet: the agent only planned

      view = await post("/_study/action", { type: "approvePlan" });
      expect(view.phase).toBe("stage1");
      const pause = story.pauseStep(t.regime, t.pauseDraw);
      const until = t.regime === "BATCH" ? 4 : pause;
      expectAt(until); // the agent stopped at the checkpoint (BATCH: the end)
      // Earlier steps are committed: the open changes are exactly the step under review (BATCH: the whole feature).
      const open = execFileSync("git", ["status", "--porcelain", "-uall"], { cwd: trialDir, encoding: "utf8" }).split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
      expect(open).toEqual(story.diff(t.variant, t.regime === "BATCH" ? 1 : pause, until).map((d) => d.path).sort());
      view = await post("/_study/action", { type: "stage1", decision: "accept" });
      expect(view.phase).toBe("stage2");
      expect(view.probe.options).toHaveLength(4);
      view = await post("/_study/action", { type: "stage2", probeAnswer: 0, final: "confirm" });
      expect(view.phase).toBe("reviewing");
      expect(view.finished).toBe(true);
      expectAt(4); // feature complete
      expect((await app.inject({ method: "POST", url: "/_study/action", payload: UNDERSTANDING })).statusCode).toBe(409); // not before "I've reviewed"
      view = await post("/_study/action", { type: "reviewed" });
      expect(view.phase).toBe("understanding");
      expect(view.understanding.items).toHaveLength(4);
      for (const it of view.understanding.items) expect(it.options).toHaveLength(4);
      expect((await app.inject({ method: "POST", url: "/_study/action", payload: { ...UNDERSTANDING, confidences: [50, 70, 90, 95] } })).statusCode).toBe(400);
      view = await post("/_study/action", UNDERSTANDING);
    }
    expect(view.phase).toBe("postsurvey");
    expect(view.sessions).toHaveLength(7);
    expect(new Set(view.sessions.map((x: { project: string }) => x.project)).size).toBe(1); // all stories live in the shared codebase
    expect((await app.inject({ method: "POST", url: "/_study/finish" })).statusCode).toBe(409); // not before the post-survey
    expect((await app.inject({ method: "POST", url: "/_study/action", payload: { ...POSTSURVEY, ranking: ["END", "END"] } })).statusCode).toBe(400);
    view = await post("/_study/action", POSTSURVEY);
    expect(view.phase).toBe("debrief");
    expect((await post("/_study/finish")).ok).toBe(true);

    const bundle = JSON.parse(fs.readFileSync(path.join(cfg.exportDir, "PT_42.json"), "utf8"));
    expect(bundle.trials).toHaveLength(6); // practice is not among the measured trials
    expect(bundle.practice.story).toBe("US0");
    expect(bundle.survey.pre.scores.ncs6).toBeCloseTo((4 + 3 + 4 + 4 + 5 + 4) / 6); // items 3,4 reverse-keyed: 6-2=4
    expect(bundle.survey.pre.attentionCheckPassed).toBe(true);
    expect(bundle.survey.post.ranking).toEqual(["PAUSE", "END"]);
    expect(new Set(bundle.trials.map((t: { regime: string }) => t.regime))).toEqual(new Set(["BATCH", "MILESTONE", "NON_MILESTONE"]));
    for (const t of bundle.trials) {
      expect(t.paas).toBe(6);
      expect(t.understandingConfidences).toEqual([50, 70, 90, 100]);
      expect(t.reviewedLines).toBeGreaterThan(0);
      expect(t.finalReviewMs).toBeGreaterThanOrEqual(0);
      if (t.regime === "BATCH") expect(t.pauseStep).toBe(4);
      if (t.regime === "MILESTONE") expect(t.pauseStep).toBe(t.milestoneStep);
      if (t.regime === "NON_MILESTONE") expect([1, 2, 3].filter((n) => n !== t.milestoneStep)).toContain(t.pauseStep);
      expect(t.flawStepReviewed).toBe(t.regime === "BATCH" || t.pauseStep === t.flawStep);
      const story = load(t.story);
      const [from, to] = t.regime === "BATCH" ? [1, 4] : [t.pauseStep, t.pauseStep];
      const changed = story.diff(t.variant, from, to).reduce((n, d) => n + changedLines(d.before, d.after).length, 0);
      expect(t.reviewedLines).toBe(changed);
    }
    const batch = bundle.trials.filter((t: { regime: string }) => t.regime === "BATCH");
    const paused = bundle.trials.filter((t: { regime: string }) => t.regime !== "BATCH");
    expect(Math.min(...batch.map((t: { reviewedLines: number }) => t.reviewedLines))).toBeGreaterThan(Math.max(...paused.map((t: { reviewedLines: number }) => t.reviewedLines)));
    const csv = fs.readFileSync(path.join(cfg.exportDir, "trials.csv"), "utf8").trim().split("\n");
    expect(csv).toHaveLength(7);
    expect(csv[0]).toContain("understandingScore");
    expect(csv[0]).toContain("reviewedLines");
    expect(csv[0]).toContain("u1_answer,u1_correct,u1_confidence,u1_milestone,u1_ms,u1_changes,u2_answer");
    expect(bundle.trials[0].understandingAnswers).toHaveLength(4);
    expect(bundle.trials[0].understandingScore).toBe(bundle.trials[0].understandingCorrects.filter(Boolean).length);
    expect(bundle.events.some((e: { type: string }) => e.type === "replay_call")).toBe(true);
    const jsonl = fs.readFileSync(path.join(cfg.exportDir, "PT_42.events.jsonl"), "utf8").trim().split("\n");
    expect(jsonl.length).toBe(bundle.events.length);
    await app.close();
  });

  it("grades the probe by execution, not by option position", async () => {
    const cfg = fakeConfig("PT2", "7", 3);
    const app = await buildApp(cfg);
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();
    const readEvents = () => fs.readFileSync(path.join(cfg.exportDir, "PT2_7.events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

    await post("/_study/action", { type: "begin" });
    await post("/_study/action", PRESURVEY);
    await post("/_study/action", { type: "approvePlan" });
    // practice trial (US0, Correct, paused at its milestone, step 2): answer with the displayed option that equals the true output
    const view = await post("/_study/action", { type: "stage1", decision: "accept" });
    const truth = load("US0").def.probes[1]!.expected.Correct;
    const idx = (view.probe.options as string[]).indexOf(truth);
    await post("/_study/action", { type: "stage2", probeAnswer: idx, final: "confirm" });
    const s2 = readEvents().find((e) => e.type === "stage2_submit").data;
    expect(s2.probeCorrect).toBe(true);
    await app.close();
  });
});

describe("demo mode", () => {
  it("starts a fresh session after Finish instead of stopping", async () => {
    const cfg = fakeConfig("DEMO1", "11", 5, { exitOnFinish: true, demo: true });
    const app = await buildApp(cfg);
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();

    let view = (await app.inject({ url: "/_study/state" })).json();
    expect(view.demo).toBe(true);
    for (let guard = 0; view.phase !== "debrief" && guard < 100; guard++) {
      switch (view.phase) {
        case "intro": view = await post("/_study/action", { type: "begin" }); break;
        case "presurvey": view = await post("/_study/action", PRESURVEY); break;
        case "plan": view = await post("/_study/action", { type: "approvePlan" }); break;
        case "stage1": view = await post("/_study/action", { type: "stage1", decision: "accept" }); break;
        case "stage2": view = await post("/_study/action", { type: "stage2", probeAnswer: 0, final: "confirm" }); break;
        case "reviewing": view = await post("/_study/action", { type: "reviewed" }); break;
        case "understanding": view = await post("/_study/action", UNDERSTANDING); break;
        case "postsurvey": view = await post("/_study/action", POSTSURVEY); break;
      }
    }
    expect(view.phase).toBe("debrief");
    expect(await post("/_study/finish")).toEqual({ ok: true, restarted: true });
    expect(fs.existsSync(path.join(cfg.exportDir, "DEMO1_11.json"))).toBe(true);

    const fresh = (await app.inject({ url: "/_study/state" })).json();
    expect(fresh.phase).toBe("intro");
    expect(fresh.participantId).not.toBe("DEMO1");
    expect(fresh.participantId).toMatch(/^[A-Z2-9]{6}$/);
    expect((await post("/_study/action", { type: "begin" })).phase).toBe("presurvey");
    await app.close();
  });
});

describe("condition tag (experimenter aid)", () => {
  const plan = generateSessionPlan({ participantId: "TG", studySeed: "5", group: 2 });
  const mk = (show: boolean) => {
    const replay = new ReplayEndpoint();
    const deps = { agent: new FakeAgentHost(replay), replay, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} };
    return new StudySession(plan, makeStoryLoader(trialsDir, capturesDir), deps, () => {}, Date.now, show);
  };
  const letter = { BATCH: "B", MILESTONE: "M", NON_MILESTONE: "N" } as const;

  it("is absent by default, so participants cannot see their condition", async () => {
    const s = mk(false);
    await startSession(s);
    expect(s.view().debugTag).toBeUndefined();
    expect(JSON.stringify(s.view())).not.toMatch(/debugTag|Flawed|Correct|BATCH|MILESTONE/);
  });

  it("shows regime letter and variant letter for the current trial when enabled", async () => {
    const s = mk(true);
    expect(s.view().debugTag).toBeUndefined(); // no trial on screen yet
    await startSession(s);
    const t = plan.practice;
    expect(s.view().debugTag).toBe(`${letter[t.regime]}·${t.variant === "Flawed" ? "F" : "C"}`);
    expect(s.view().debugTag).toMatch(/^[BMN]·[CF]$/);
  });
});

describe("stage-1 dwell", () => {
  it("is measured from the moment the agent has stopped at the review", async () => {
    let t = 1000;
    const plan = generateSessionPlan({ participantId: "PT3", studySeed: "9", group: 0 });
    const replay = new ReplayEndpoint();
    const deps = { agent: new FakeAgentHost(replay), replay, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} };
    const session = new StudySession(plan, makeStoryLoader(trialsDir, capturesDir), deps, () => {}, () => t);
    await startSession(session);
    t += 3000; // reading the plan
    await session.act({ type: "approvePlan" });
    t += 4000; // participant reviews
    await session.act({ type: "stage1", decision: "accept" });
    expect((session.events.find((e) => e.type === "plan_approved")!.data as { ms: number }).ms).toBe(3000);
    expect((session.events.find((e) => e.type === "stage1_submit")!.data as { dwellMs: number }).dwellMs).toBe(4000);
  });
});

describe("telemetry from the agent UI", () => {
  it("turns UI events into per-trial measures for the review, the probe and the final look", async () => {
    let t = 1000;
    const plan = generateSessionPlan({ participantId: "PT5", studySeed: "4", group: 0 });
    const replay = new ReplayEndpoint();
    const deps = { agent: new FakeAgentHost(replay), replay, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} };
    const s = new StudySession(plan, makeStoryLoader(trialsDir, capturesDir), deps, () => {}, () => t);
    await startSession(s);
    s.recordUi({ type: "review", data: { open: true } }); // opened while the agent still planned: counts only from the review on
    t += 500;
    await s.act({ type: "approvePlan" });
    t += 2000;
    s.recordUi({ type: "diff_scroll", data: { coverage: 0.4 } });
    s.recordUi({ type: "diff_scroll", data: { coverage: 0.9 } });
    s.recordUi({ type: "file", data: { name: "greeting.ts" } });
    s.recordUi({ type: "file", data: { name: "greeting.ts" } });
    s.recordUi({ type: "file", data: { name: "types.ts" } });
    s.recordUi({ type: "terminal_command", data: { line: "npm test" } });
    s.recordUi({ type: "terminal_command", data: { line: "ls" } });
    t += 1000;
    s.recordUi({ type: "review", data: { open: false } });
    t += 1000;
    await s.act({ type: "stage1", decision: "accept" });
    s.recordUi({ type: "terminal_command", data: { line: "node -e 'console.log(1)'" } });
    await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    s.recordUi({ type: "review", data: { open: true } });
    t += 1500;
    await s.act({ type: "reviewed" });
    const r = s.events.find((e) => e.type === "stage2_submit")!.data as Record<string, number>;
    expect(r.changesViewMsStage1).toBe(3000); // review shown -> closed
    expect(r.diffCoverageStage1).toBe(0.9);
    expect(r.filesOpenedStage1).toBe(2);
    expect(r.terminalCommandsStage1).toBe(2);
    expect(r.testRunsStage1).toBe(1);
    expect(r.terminalCommandsProbe).toBe(1);
    expect(s.events.some((e) => e.type === "ui_terminal_command")).toBe(true);
    await s.act(UNDERSTANDING);
    const end = s.events.find((e) => e.type === "trial_end")!.data as Record<string, number>;
    expect(end.changesViewMsFinal).toBe(1500);
    expect(() => s.recordUi({ type: "nonsense", data: {} })).toThrow();
  });
});

describe("code regions for review telemetry", () => {
  it("times code on screen, focus, idleness, chat reading and quiz answers per trial", async () => {
    let t = 1000;
    const plan = generateSessionPlan({ participantId: "PT6", studySeed: "4", group: 0 });
    const replay = new ReplayEndpoint();
    const deps = { agent: new FakeAgentHost(replay), replay, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} };
    const loader = makeStoryLoader(trialsDir, capturesDir);
    const s = new StudySession(plan, loader, deps, () => {}, () => t);
    await startSession(s);
    // Skip ahead to the first BATCH trial: its review covers the whole feature, so the flaw region is on screen.
    const trials = [plan.practice, ...plan.trials];
    const k = trials.findIndex((tr) => tr.position > 0 && tr.regime === "BATCH");
    for (let i = 0; i < k; i++) {
      await s.act({ type: "approvePlan" });
      await s.act({ type: "stage1", decision: "accept" });
      await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
      await s.act({ type: "reviewed" });
      await s.act(UNDERSTANDING);
    }
    const story = loader(trials[k]!.story);
    const variant = trials[k]!.variant;
    const flaw = story.flawRegion(variant, 4)[0]!;
    const hunks = story.hunks(variant, 1, 4);
    await s.act({ type: "approvePlan" });
    s.recordUi({ type: "review", data: { open: true } });
    s.recordUi({ type: "diff_view", data: { views: [{ file: flaw.file, from: flaw.from, to: flaw.to }] } });
    t += 2000;
    s.recordUi({ type: "diff_view", data: { views: [] } });
    s.recordUi({ type: "focus", data: { focused: false } });
    t += 3000;
    s.recordUi({ type: "focus", data: { focused: true } });
    s.recordUi({ type: "idle", data: { idle: true } });
    s.recordUi({ type: "chat_scroll", data: { back: true } });
    s.recordUi({ type: "chat_scroll", data: { back: false } });
    s.recordUi({ type: "tool_expand", data: { label: "Used 2 Write, Shell" } });
    s.recordUi({ type: "test_result", data: { pass: 3, fail: 1 } });
    s.recordUi({ type: "test_result", data: { pass: 4, fail: 0 } });
    t += 4000; // still idle at the decision: counts up to it
    await s.act({ type: "stage1", decision: "reject" });
    const s1 = [...s.events].reverse().find((e) => e.type === "stage1_submit")!.data as { ui: Record<string, unknown> };
    expect(s1.ui).toMatchObject({ hunks: hunks.length, flawMs: 2000, flawSeen: true, unfocusedMs: 3000, idleMs: 4000, chatBacks: 1, toolExpands: 1, testFails: 1 });
    expect(s1.ui.hunksViewed).toBe(hunks.filter((h) => h.file === flaw.file && h.from <= flaw.to && flaw.from <= h.to).length);
    const detail = [...s.events].reverse().find((e) => e.type === "review_window")!.data as { fileMs: Record<string, number> };
    expect(detail.fileMs[flaw.file]).toBe(2000);

    await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    s.recordUi({ type: "idle", data: { idle: false } });
    t += 1000;
    await s.act({ type: "reviewed" });
    await s.act(UNDERSTANDING);
    const end = [...s.events].reverse().find((e) => e.type === "trial_end")!.data as Record<string, unknown>;
    expect(end).toMatchObject({ flawRegionSeenStage1: true, flawRegionMsStage1: 2000, idleMsStage1: 4000, testFailRunsStage1: 1, flawRegionSeenFinal: false, hunksFinal: hunks.length });
    expect(end.understandingItemMs).toEqual(UNDERSTANDING.itemMs);
    expect(end.understandingAnswerChanges).toEqual(UNDERSTANDING.answerChanges);
  });
});
