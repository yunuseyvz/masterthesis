import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateSessionPlan, type SessionPlan } from "@beacon/shared";
import { buildApp } from "./app.js";
import { FakeAgentHost } from "./agent.js";
import { StudySession } from "./machine.js";
import { loadReference, referenceSteps } from "./reference.js";
import { projectDir, trialsDir } from "./test-paths.js";
import { changedLines } from "./lines.js";
import { loadStory, makeStoryLoader } from "./trial.js";

const load = (id: string) => loadStory(trialsDir, projectDir, id);
const ref = (id: string) => loadReference(load(id));

/** A session's dependencies with the fake agent, which writes the reference code (see FakeAgentHost). */
function fakeDeps(plan: SessionPlan, loader = makeStoryLoader(trialsDir, projectDir)) {
  const agent = new FakeAgentHost(referenceSteps(loader, () => [plan.practice, ...plan.trials]));
  return { agent, endpoint: { load: () => {}, endPlanning: () => {} }, checkpoints: agent.checkpoints, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} };
}

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

const UNDERSTANDING = { type: "understanding", answers: [0, 0, 0, 0, 0], confidences: [25, 55, 85, 100, 40], paas: 6, itemMs: [4000, 3000, 5000, 2000, 1000], answerChanges: [0, 1, 0, 0, 2] };

/** begin -> presurvey -> first checkpoint */
async function startSession(session: StudySession) {
  await session.act({ type: "begin" });
  await session.act(PRESURVEY);
}

const fakeConfig = (participantId: string, studySeed: string, group: number, extra: object = {}) => ({
  participantId, studySeed, group, trialsDir, projectDir, exitOnFinish: false, sandbox: {},
  exportDir: fs.mkdtempSync(path.join(os.tmpdir(), "exp-")),
  workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")),
  agent: { kind: "fake" as const },
  ...extra,
});

describe("service worker", () => {
  it("replaces opencode's caching service worker with one that clears the cache and removes itself", async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-"));
    fs.writeFileSync(path.join(staticDir, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(staticDir, "sw.js"), "precacheAndRoute([])");
    const app = await buildApp({ ...fakeConfig("SW", "1", 0), staticDir });
    const res = await app.inject({ url: "/sw.js" });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toContain("caches.delete");
    expect(res.body).toContain("unregister");
    expect(res.body).not.toContain("precache");
    await app.close();
  });
});

describe("agent proxy", () => {
  it("refuses requests from the browser that would change the agent's session or its configuration", async () => {
    const { isBlocked } = await import("./app.js");
    for (const [m, u] of [
      ["POST", "/api/session"],
      ["DELETE", "/api/session/ses_1"],
      ["POST", "/api/session/ses_1/prompt"],
      ["POST", "/api/session/ses_1/agent"],
      ["POST", "/api/session/ses_1/revert/stage"],
      ["DELETE", "/api/session/ses_1/revert"],
      ["POST", "/api/session/ses_1/fork"],
      ["POST", "/api/experimental/mcp/review/disconnect"],
      ["DELETE", "/api/experimental/mcp/review"],
      ["PATCH", "/api/experimental/config"],
    ]) expect(isBlocked(m!, u!), `${m} ${u}`).toBe(true);
    // The composer sets the session's model before every message (the configuration has only the live model).
    expect(isBlocked("POST", "/api/session/ses_1/model")).toBe(false);
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
      const r = ref(t.story);
      const trialDir = path.join(cfg.workRoot, "PT", `${String(t.position).padStart(2, "0")}-${t.story}`);
      expect(view.trial).toBe(i + 1);
      expect(view.practice).toBe(i === 0);
      expect(view.phase).toBe("plan");
      expect(JSON.stringify(view.story)).not.toContain("summary");
      // The project on disk, for every file the feature touches.
      const touched = r.diff(t.variant, 1, 4).map((d) => d.path);
      const expectAt = (step: number) => {
        const expected = r.workspaceAt(t.variant, step);
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
      expect(open).toEqual(r.diff(t.variant, t.regime === "BATCH" ? 1 : pause, until).map((d) => d.path).sort());
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
      expect(view.understanding.items).toHaveLength(5);
      for (const it of view.understanding.items) expect(it.options).toHaveLength(4);
      expect((await app.inject({ method: "POST", url: "/_study/action", payload: { ...UNDERSTANDING, confidences: [50, 55, 85, 100] } })).statusCode).toBe(400);
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
      expect(t.understandingConfidences).toEqual([25, 55, 85, 100, 40]);
      expect(t.reviewedLines).toBeGreaterThan(0);
      expect(t.finalReviewMs).toBeGreaterThanOrEqual(0);
      if (t.regime === "BATCH") expect(t.pauseStep).toBe(4);
      if (t.regime === "MILESTONE") expect(t.pauseStep).toBe(t.milestoneStep);
      if (t.regime === "NON_MILESTONE") expect([1, 2, 3].filter((n) => n !== t.milestoneStep)).toContain(t.pauseStep);
      expect(t.flawStepReviewed).toBe(t.regime === "BATCH" || t.pauseStep === t.flawStep);
      const [from, to] = t.regime === "BATCH" ? [1, 4] : [t.pauseStep, t.pauseStep];
      const changed = ref(t.story).diff(t.variant, from, to).reduce((n, d) => n + changedLines(d.before, d.after).length, 0);
      expect(t.reviewedLines).toBe(changed);
    }
    const batch = bundle.trials.filter((t: { regime: string }) => t.regime === "BATCH");
    const paused = bundle.trials.filter((t: { regime: string }) => t.regime !== "BATCH");
    expect(Math.min(...batch.map((t: { reviewedLines: number }) => t.reviewedLines))).toBeGreaterThan(Math.max(...paused.map((t: { reviewedLines: number }) => t.reviewedLines)));
    const csv = fs.readFileSync(path.join(cfg.exportDir, "trials.csv"), "utf8").trim().split("\n");
    expect(csv).toHaveLength(7);
    expect(csv[0]).toContain("understandingScore");
    expect(csv[0]).toContain("reviewedLines");
    expect(csv[0]).toContain("u1_answer,u1_correct,u1_confidence,u1_role,u1_step,u1_milestone,u1_ms,u1_changes,u2_answer");
    expect(bundle.trials[0].understandingAnswers).toHaveLength(5);
    // Each trial asks one milestone item, about its milestone step, and one about what builds on it.
    for (const t of bundle.trials) {
      expect(t.understandingSteps[t.understandingRoles.indexOf("open-case")]).toBe(t.milestoneStep);
      expect(t.understandingRoles.filter((r: string) => r === "dependency")).toHaveLength(1);
    }
    expect(bundle.trials[0].understandingScore).toBe(bundle.trials[0].understandingCorrects.filter(Boolean).length);
    // The probe was graded on the code under review, the understanding items on the finished code.
    expect(bundle.events.filter((e: { type: string }) => e.type === "live_probe")).toHaveLength(7);
    expect(bundle.events.filter((e: { type: string }) => e.type === "live_key")).toHaveLength(7);
    const jsonl = fs.readFileSync(path.join(cfg.exportDir, "PT_42.events.jsonl"), "utf8").trim().split("\n");
    expect(jsonl.length).toBe(bundle.events.length);
    await app.close();
  }, 120_000); // every trial runs its questions' scripts on the code

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
  }, 120_000);
});

describe("condition tag (experimenter aid)", () => {
  const plan = generateSessionPlan({ participantId: "TG", studySeed: "5", group: 2 });
  const mk = (show: boolean) => {
    return new StudySession(plan, makeStoryLoader(trialsDir, projectDir), fakeDeps(plan), () => {}, Date.now, show);
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
    const session = new StudySession(plan, makeStoryLoader(trialsDir, projectDir), fakeDeps(plan), () => {}, () => t);
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
    const s = new StudySession(plan, makeStoryLoader(trialsDir, projectDir), fakeDeps(plan), () => {}, () => t);
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
    const loader = makeStoryLoader(trialsDir, projectDir);
    const s = new StudySession(plan, loader, fakeDeps(plan, loader), () => {}, () => t);
    await startSession(s);
    // Skip ahead to the first BATCH trial: its review covers the whole feature.
    const trials = [plan.practice, ...plan.trials];
    const k = trials.findIndex((tr) => tr.position > 0 && tr.regime === "BATCH");
    for (let i = 0; i < k; i++) {
      await s.act({ type: "approvePlan" });
      await s.act({ type: "stage1", decision: "accept" });
      await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
      await s.act({ type: "reviewed" });
      await s.act(UNDERSTANDING);
    }
    const hunks = loadReference(loader(trials[k]!.story)).hunks(trials[k]!.variant, 1, 4);
    const seen = hunks[0]!;
    await s.act({ type: "approvePlan" });
    s.recordUi({ type: "review", data: { open: true } });
    s.recordUi({ type: "diff_view", data: { views: [{ file: seen.file, from: seen.from, to: seen.to }] } });
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
    await s.act({ type: "stage1", decision: "accept" });
    const s1 = [...s.events].reverse().find((e) => e.type === "stage1_submit")!.data as { ui: Record<string, unknown> };
    // The hunks are the uncommitted changes the agent made; the flaw's place in its code is not known (no flaw region).
    expect(s1.ui).toMatchObject({ hunks: hunks.length, hunksViewed: 1, flawMs: 0, flawSeen: false, unfocusedMs: 3000, idleMs: 4000, chatBacks: 1, toolExpands: 1, testFails: 1 });
    const detail = [...s.events].reverse().find((e) => e.type === "review_window")!.data as { fileMs: Record<string, number> };
    expect(detail.fileMs[seen.file]).toBe(2000);

    await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    s.recordUi({ type: "idle", data: { idle: false } });
    t += 1000;
    await s.act({ type: "reviewed" });
    await s.act(UNDERSTANDING);
    const end = [...s.events].reverse().find((e) => e.type === "trial_end")!.data as Record<string, unknown>;
    expect(end).toMatchObject({ idleMsStage1: 4000, testFailRunsStage1: 1, hunksStage1: hunks.length });
    expect(end.understandingItemMs).toEqual(UNDERSTANDING.itemMs);
    expect(end.understandingAnswerChanges).toEqual(UNDERSTANDING.answerChanges);
  });
});

describe("rejection", () => {
  it("lets the agent ask; the participant's one answer makes it fix the step and finish, then the final look opens", async () => {
    const plan = generateSessionPlan({ participantId: "RJ", studySeed: "2", group: 0 });
    const deps = fakeDeps(plan);
    const s = new StudySession(plan, makeStoryLoader(trialsDir, projectDir), deps, () => {});
    await startSession(s);
    await s.act({ type: "approvePlan" });
    await s.act({ type: "stage1", decision: "reject" });
    const view = await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    expect(view.phase).toBe("feedback");
    const url = `/api/session/${view.agentSessionId}/prompt`;
    expect(s.acceptsComposerMessage("POST", "/api/session/other/prompt")).toBe(false);
    expect(s.acceptsComposerMessage("POST", url)).toBe(true);
    await s.composerMessage(url, JSON.stringify({ text: "Use the first name only." }));
    expect(s.acceptsComposerMessage("POST", url)).toBe(false); // one message only
    for (let i = 0; i < 300 && s.view().phase !== "reviewing"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(s.view().phase).toBe("reviewing");
    expect(deps.agent.prompts.at(-1)!.text).toBe("Use the first name only.");
    // The practice trial pauses at step 2: held, rejected, then called again for the fix, and step 3 follows.
    expect(s.events.filter((e) => e.type === "live_checkpoint").map((e) => (e.data as { step: number }).step)).toEqual([1, 2, 2, 3]);
    expect(s.events.find((e) => e.type === "feedback_submit")!.data).toMatchObject({ text: "Use the first name only." });
  });

  it("sends an agent that stops early after an unclear answer on, hidden, so the review shows the whole feature", async () => {
    const plan = generateSessionPlan({ participantId: "RK", studySeed: "2", group: 0 });
    const deps = fakeDeps(plan);
    const s = new StudySession(plan, makeStoryLoader(trialsDir, projectDir), deps, () => {});
    await startSession(s);
    await s.act({ type: "approvePlan" });
    await s.act({ type: "stage1", decision: "reject" });
    const view = await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    // The fake agent asks again after an answer this short, as a model did in a test session ("coc").
    await s.composerMessage(`/api/session/${view.agentSessionId}/prompt`, JSON.stringify({ text: "coc" }));
    for (let i = 0; i < 300 && s.view().phase !== "reviewing"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(s.view().phase).toBe("reviewing");
    const goOn = s.events.filter((e) => e.type === "live_go_on");
    expect(goOn).toHaveLength(1);
    expect((goOn[0]!.data as { missing: string[] }).missing).toContain("src/lib/greeting/batch.ts");
    expect(s.events.some((e) => e.type === "live_incomplete")).toBe(false);
    expect(s.events.filter((e) => e.type === "live_checkpoint").map((e) => (e.data as { step: number }).step)).toEqual([1, 2, 2, 3]);
    // Every item can be graded on the finished feature.
    expect((s.events.find((e) => e.type === "live_key")!.data as { understanding: unknown[] }).understanding).not.toContain(null);
  });
});

describe("an agent that stops before the pause", () => {
  it("is sent on, hidden, so the review still pauses at the scored step", async () => {
    const plan = generateSessionPlan({ participantId: "PG", studySeed: "2", group: 0 });
    const deps = fakeDeps(plan);
    deps.agent.stopAfterStep = 1; // the practice trial pauses after step 2
    const s = new StudySession(plan, makeStoryLoader(trialsDir, projectDir), deps, () => {});
    await startSession(s);
    const view = await s.act({ type: "approvePlan" });
    expect(view.phase).toBe("stage1");
    expect(s.events.filter((e) => e.type === "live_pause_go_on")).toHaveLength(1);
    expect(s.events.some((e) => e.type === "live_pause_missed")).toBe(false);
    expect(s.events.filter((e) => e.type === "live_checkpoint").map((e) => [(e.data as { step: number }).step, (e.data as { held: boolean }).held])).toEqual([[1, false], [2, true]]);
    // The participant did not see the message that sent it on.
    expect(deps.agent.prompts.map((p) => p.text).filter((t) => t.startsWith("You stopped"))).toHaveLength(1);
    await s.act({ type: "stage1", decision: "accept" });
    await s.act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    expect(s.view().phase).toBe("reviewing");
    await s.act({ type: "reviewed" });
    await s.act(UNDERSTANDING);
    expect(s.events.find((e) => e.type === "trial_end")!.data).toMatchObject({ pauseMissed: false, featureComplete: true });
  });
});

describe("step check at the checkpoint", () => {
  it("refuses a step whose files are missing or that writes a later step's files, with a neutral message", async () => {
    const plan = generateSessionPlan({ participantId: "SC", studySeed: "2", group: 0 });
    const loader = makeStoryLoader(trialsDir, projectDir);
    const ref = loadReference(loader("US0"));
    // The practice story (US0, paused after step 2): step 1 without its file, step 2 together with step 3's file.
    const steps = [new Map(), new Map([...ref.step("Correct", 2), ...ref.step("Correct", 3)]), ref.step("Correct", 3), ref.step("Correct", 4)];
    const agent = new FakeAgentHost(() => steps);
    const s = new StudySession(plan, loader, { agent, endpoint: { load: () => {}, endPlanning: () => {} }, checkpoints: agent.checkpoints, workRoot: fs.mkdtempSync(path.join(os.tmpdir(), "work-")), sandbox: {} }, () => {});
    const answers: string[] = [];
    await startSession(s);
    // Record what the agent is told.
    const wrapped = agent.checkpoints.handler!;
    agent.checkpoints.handler = async (step) => {
      const a = await wrapped(step);
      answers.push(a);
      return a;
    };
    // The fake agent does not retry a failed step, so only the logged checks and the first answer are compared.
    await s.act({ type: "approvePlan" });
    const checks = s.events.filter((e) => e.type === "live_step_check").map((e) => e.data as { step: number; passed: boolean; missing: string[]; early: string[] });
    expect(checks[0]).toMatchObject({ step: 1, passed: false, missing: [...ref.step("Correct", 1).keys()] });
    expect(answers[0]).toMatch(/^Step 1 check failed: .* was not changed\. Complete step 1 as planned/);
    expect(answers[0]).not.toMatch(/outline|Flawed|Correct/);
    const step2 = checks.find((c) => c.step === 2)!;
    expect(step2).toMatchObject({ passed: false, early: [...ref.step("Correct", 3).keys()] });
  });
});

describe("the agent UI's path", () => {
  it("is filled into the built app when the server starts, once", async () => {
    const { setBasePath } = await import("./app.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dist-"));
    fs.mkdirSync(path.join(dir, "_assets"));
    fs.writeFileSync(path.join(dir, "index.html"), `<script src="/__STUDY_BASE__/_assets/a.js"></script>`);
    fs.writeFileSync(path.join(dir, "_assets", "a.js"), `const b = "/__STUDY_BASE__/";import("/__STUDY_BASE__/_assets/c.js")`);
    fs.writeFileSync(path.join(dir, "logo.png"), "/__STUDY_BASE__/");
    setBasePath(dir, "/study/s/u/");
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toBe(`<script src="/study/s/u/_assets/a.js"></script>`);
    expect(fs.readFileSync(path.join(dir, "_assets", "a.js"), "utf8")).toBe(`const b = "/study/s/u/";import("/study/s/u/_assets/c.js")`);
    expect(fs.readFileSync(path.join(dir, "logo.png"), "utf8")).toBe("/__STUDY_BASE__/");
    setBasePath(dir, "/other/");
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toContain("/study/s/u/");
  });
});
