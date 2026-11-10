/**
 * Plays one whole study session without a browser: survey, the practice feature and six measured features, the
 * postsurvey and the export. A mechanical test of the whole flow with the real agent; the data are not meant for
 * analysis.
 *
 * Usage (study-harness/server):
 *   set -a && . ../../.env && set +a
 *   npx tsx src/session-run.ts [--participant MECH01] [--seed 1] [--group 0] [--round 0]
 *     [--model deepseek-v4.1-flash] [--upstream https://opencode.ai/zen/go/v1] [--out /tmp/session-runs]
 *
 * It accepts every feature except one (see REJECT_AT), where it rejects with an unclear answer: that exercises the
 * rejection path and the hidden reminder.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { generateSessionPlan } from "@beacon/shared";
import { OpencodeHost } from "./agent.js";
import { CheckpointServer } from "./checkpoint.js";
import { makeEventSink, writeBundle } from "./export.js";
import { LiveEndpoint } from "./live.js";
import { StudySession, type StudyEvent } from "./machine.js";
import { makeStoryLoader } from "./trial.js";

const a = parseArgs({
  options: {
    participant: { type: "string", default: "MECH01" },
    seed: { type: "string", default: "1" },
    group: { type: "string", default: "0" },
    round: { type: "string", default: "0" },
    model: { type: "string", default: "deepseek-v4.1-flash" },
    upstream: { type: "string", default: "https://opencode.ai/zen/go/v1" },
    out: { type: "string", default: "/tmp/session-runs" },
    ports: { type: "string", default: "5200" },
  },
}).values;
const here = path.dirname(new URL(import.meta.url).pathname);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(a.out!, `${a.participant}-${stamp}`);
const exportDir = path.join(out, "exports");
fs.mkdirSync(exportDir, { recursive: true });
const ports = Number(a.ports);

const trialsDir = process.env.TRIALS_DIR ?? path.resolve(here, "../../trials");
const projectDir = path.resolve(here, "../../project");
const loadStory = makeStoryLoader(trialsDir, projectDir);

const events: StudyEvent[] = [];
let session: StudySession | undefined;
const log = (type: string, data: unknown) => session?.log(type, data);
const endpoint = new LiveEndpoint({ upstream: a.upstream!, apiKey: process.env.LIVE_API_KEY, model: a.model!, log });
const checkpoints = new CheckpointServer(log);
await endpoint.listen(ports);
await checkpoints.listen(ports + 1);
const agent = await new OpencodeHost({
  bin: path.resolve(here, "../../../node_modules/.bin/opencode"),
  port: ports + 2,
  home: path.join(out, "home"),
  sandbox: {},
  log,
  live: { url: `http://127.0.0.1:${ports}/v1`, model: a.model!, checkpointUrl: `http://127.0.0.1:${ports + 1}/mcp` },
}).start();

const plan = generateSessionPlan({ participantId: a.participant!, studySeed: a.seed!, group: Number(a.group), round: Number(a.round) });
const sink = makeEventSink(exportDir, plan.participantId, plan.studySeed);
const sessionLog = (e: StudyEvent) => {
  sink(e);
  events.push(e);
  if (/^(trial_start|trial_end|review_shown|final_review_shown|live_go_on|live_incomplete|live_pause_missed|feedback_shown|postsurvey_shown|debrief_shown|finish)$/.test(e.type)) {
    console.log(`${new Date().toISOString().slice(11, 19)} ${e.type} ${JSON.stringify(e.data).slice(0, 220)}`);
  }
};
const study = new StudySession(plan, loadStory, { agent, endpoint, checkpoints, workRoot: path.join(out, "work"), sandbox: {} }, sessionLog);
session = study;

/** Waits until the session reaches `phase`. */
async function phase(name: string, timeoutMs = 15 * 60_000) {
  const until = Date.now() + timeoutMs;
  while (study.view().phase !== name) {
    if (Date.now() > until) throw new Error(`still ${study.view().phase}, wanted ${name}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
const view = () => study.view();
/** Items whose answer key the code could not produce (null): not gradeable in this run. */
const ungradeable = () => {
  let n = 0;
  for (const e of events) if (e.type === "live_key") n += (e.data as { understanding: (string | null)[] }).understanding.filter((x) => x === null).length;
  return n;
};
const act = (action: unknown) => study.act(action);

// One unclear rejection on a measured feature: the agent must not ask twice, and a missed step must be caught.
const REJECT_AT = 2;

const started = Date.now();
try {
  await phase("intro");
  await act({ type: "begin" });
  await phase("presurvey");
  await act({
    type: "presurvey",
    consent: true,
    demographics: { ageGroup: "25-34", programmingYears: "3-5", aiAssistantUse: "weekly", codeReviewFrequency: "weekly", tsFamiliarity: 4 },
    ncs: [4, 3, 2, 2, 5, 4],
    attention: 4,
    stias: [5, 5, 4],
  });

  for (let i = 0; i < 7; i++) {
    await phase("plan");
    const t = plan.practice.position === 0 && i === 0 ? plan.practice : plan.trials[i - 1]!;
    console.log(`\n== trial ${i}: ${t.story} ${t.regime} ${t.variant} (${((Date.now() - started) / 60000).toFixed(1)} min)`);
    const approved = Date.now();
    await act({ type: "approvePlan" });
    await phase("stage1");
    console.log(`   plan/build -> stage1 in ${((Date.now() - approved) / 1000).toFixed(0)} s`);
    await act({ type: "stage1", decision: i === REJECT_AT ? "reject" : "accept" });
    const afterDecision = await act({ type: "stage2", probeAnswer: 0, final: "confirm" });
    if (afterDecision.phase === "feedback") {
      console.log("   rejected; the agent asked what to change");
      await study.composerMessage(`/api/session/${afterDecision.agentSessionId}/prompt`, JSON.stringify({ text: "coc" }));
    }
    await phase("reviewing");
    await act({ type: "reviewed" });
    await phase("understanding");
    await act({ type: "understanding", answers: [0, 0, 0, 0, 0], confidences: [55, 55, 55, 55, 55], paas: 5, itemMs: [1000, 1000, 1000, 1000, 1000], answerChanges: [0, 0, 0, 0, 0] });
    if (i < 6) await phase("plan");
  }

  await phase("postsurvey");
  await act({ type: "postsurvey", ranking: ["PAUSE", "END"], comment: "mechanical run" });
  await phase("debrief");
  const bundle = study.finish();
  writeBundle(exportDir, bundle);

  const byTrial = bundle.trials.map((t) => ({
    position: t.position,
    story: t.story,
    regime: t.regime,
    variant: t.variant,
    pauseStep: t.pauseStep,
    flawStepReviewed: t.flawStepReviewed,
    initialDecision: t.initialDecision,
    finalDecision: t.finalDecision,
    featureComplete: t.featureComplete,
    understandingScore: t.understandingScore,
    roles: t.understandingRoles,
    steps: t.understandingSteps,
    planMs: t.planMs,
    stage1DwellMs: t.stage1DwellMs,
  }));
  const summary = {
    participant: plan.participantId,
    group: plan.group,
    round: plan.round,
    minutes: +((Date.now() - started) / 60000).toFixed(1),
    trials: byTrial,
    goOn: events.filter((e) => e.type === "live_go_on").map((e) => e.data),
    incomplete: events.filter((e) => e.type === "live_incomplete").map((e) => e.data),
    pauseMissed: events.filter((e) => e.type === "live_pause_missed").map((e) => e.data),
    textLeaks: events.filter((e) => e.type === "live_text_leak").map((e) => e.data),
    goOnCount: events.filter((e) => e.type === "live_go_on").length,
    incompleteCount: events.filter((e) => e.type === "live_incomplete").length,
    pauseMissedCount: events.filter((e) => e.type === "live_pause_missed").length,
    textLeakCount: events.filter((e) => e.type === "live_text_leak").length,
    ungradeableItems: ungradeable(),
    events: events.length,
    exportFiles: fs.readdirSync(exportDir),
    csvRows: fs.readFileSync(path.join(exportDir, "trials.csv"), "utf8").trim().split("\n").length - 1,
  };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log("\n" + JSON.stringify(summary, null, 2) + `\n\nKept in ${out}`);
} catch (err) {
  console.error("\nFAILED:", err);
  const debug = {
    phase: study.view().phase,
    trial: study.view().trial,
    events: events.slice(-15),
  };
  fs.writeFileSync(path.join(out, "failure.json"), JSON.stringify(debug, null, 2));
  console.error(`Kept in ${out}`);
  process.exitCode = 1;
} finally {
  agent.close();
  endpoint.close();
  checkpoints.close();
  process.exit(process.exitCode ?? 0);
}
