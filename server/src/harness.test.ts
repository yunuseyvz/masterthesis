import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateSessionPlan } from "@beacon/shared";
import { buildApp } from "./app.js";
import { loadStory, makeStoryLoader } from "./corpus.js";
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
  ranking: ["PAIR_PROG", "BATCH", "ARBITRARY"],
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
    const u = story.def.understanding;
    if (flawedDiffers) expect(u.correct.Correct).not.toBe(u.correct.Flawed);
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
    const [d] = story.diff("Flawed", 2, 2);
    expect(d!.before).toBe("");
    expect(d!.after.split("\n").length).toBeLessThan(35);
    for (const n of [1, 3, 4]) {
      expect(story.diff("Flawed", n, n)).toEqual(story.diff("Correct", n, n));
    }
  });
});

describe("study flow", () => {
  it("runs presurvey, practice and six trials, exports, and never leaks variant to the client", async () => {
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-"));
    const app = buildApp({ participantId: "PT", studySeed: "42", group: 0, exportDir, corpusDir, exitOnFinish: false, sandbox: {} });
    const post = async (url: string, payload?: unknown) => (await app.inject({ method: "POST", url, payload: payload as object })).json();

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
      if (view.phase === "unscored") {
        await post("/api/study/action", { type: "ready" });
        view = await post("/api/study/action", { type: "advance" });
      }
      expect(view.phase).toBe("stage1");
      await post("/api/study/action", { type: "ready" });
      view = await post("/api/study/action", { type: "stage1", decision: "accept", scrollCoverage: 0.5 });
      expect(view.phase).toBe("stage2");
      expect(view.probe.options).toHaveLength(4);
      view = await post("/api/study/action", { type: "stage2", probeAnswer: 0, final: "confirm" });
      expect(view.phase).toBe("understanding");
      view = await post("/api/study/action", { type: "understanding", answer: 0, confidence: 4, mentalDemand: 3, frustration: 2 });
    }
    expect(view.phase).toBe("postsurvey");
    expect(view.sessions).toHaveLength(7);
    expect(new Set(view.sessions.map((x: { project: string }) => x.project)).size).toBe(7); // one project per story
    expect((await app.inject({ method: "POST", url: "/api/study/finish" })).statusCode).toBe(409); // not before the post-survey
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { ...POSTSURVEY, ranking: ["BATCH", "BATCH", "ARBITRARY"] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/study/action", payload: { ...POSTSURVEY, tlx: { ...POSTSURVEY.tlx, mental: 62 } } })).statusCode).toBe(400);
    view = await post("/api/study/action", POSTSURVEY);
    expect(view.phase).toBe("debrief");
    expect((await post("/api/study/finish")).ok).toBe(true);

    const bundle = JSON.parse(fs.readFileSync(path.join(exportDir, "PT_42.json"), "utf8"));
    expect(bundle.trials).toHaveLength(6); // practice is not among the measured trials
    expect(bundle.practice.story).toBe("US0");
    expect(bundle.survey.pre.scores.ncs6).toBeCloseTo((4 + 3 + 4 + 4 + 5 + 4) / 6); // items 3,4 reverse-keyed: 6-2=4
    expect(bundle.survey.pre.attentionCheckPassed).toBe(true);
    expect(bundle.survey.post.ranking).toEqual(["PAIR_PROG", "BATCH", "ARBITRARY"]);
    expect(bundle.survey.post.scores.rawTlx).toBeCloseTo((60 + 5 + 40 + 25 + 55 + 30) / 6);
    expect(bundle.survey.post.paas).toBe(6);
    const csv = fs.readFileSync(path.join(exportDir, "trials.csv"), "utf8").trim().split("\n");
    expect(csv).toHaveLength(7);
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
    if (view.phase === "unscored") view = await post("/api/study/action", { type: "advance" });
    view = await post("/api/study/action", { type: "stage1", decision: "accept", scrollCoverage: 1 });
    const idx = (view.probe.options as string[]).indexOf("Dear Ada,");
    await post("/api/study/action", { type: "stage2", probeAnswer: idx, final: "confirm" });
    const s2 = readEvents().find((e) => e.type === "stage2_submit").data;
    expect(s2.probeCorrect).toBe(true);
  });
});

describe("ready handshake", () => {
  it("excludes the agent-replay time from stage-1 dwell", async () => {
    let t = 1000;
    const plan = generateSessionPlan({ participantId: "PT3", studySeed: "9", group: 0 });
    const session = new StudySession(plan, makeStoryLoader(corpusDir), () => {}, () => t);
    await startSession(session);
    if (session.view().phase === "unscored") {
      await session.act({ type: "ready" });
      await session.act({ type: "advance" });
    }
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
    if (session.view().phase === "unscored") {
      await session.act({ type: "ready" });
      await session.act({ type: "advance" });
    }
    await session.act({ type: "ready" });

    let out = "";
    const strip = (x: string) => x.replace(/\x1b\[[0-9?;]*[A-Za-z]/g, "");
    const conn = tm.open({ cols: 100, rows: 30 }, (d) => (out += d), () => {})!;
    expect(conn).not.toBeNull();
    const prompt = /greeter \$ npm test/; // practice story's project
    for (let i = 0; i < 50 && !prompt.test(strip(out)); i++) await new Promise((r) => setTimeout(r, 100));
    expect(strip(out)).toMatch(prompt); // prefilled, not run
    expect(out).not.toMatch(/pass\s+3/);
    conn.write("\r");
    for (let i = 0; i < 100 && !/pass\s+3/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    expect(out).toMatch(/pass\s+3/);
    expect(events.filter((e) => e.type === "terminal_command").map((e) => e.data.line)).toEqual(["npm test"]);
    tm.dispose();
  }, 20000);
});
