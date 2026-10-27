// Writes the study design for N participants as the harness would run them: one row per measured trial with the
// condition, the milestone, flaw and pause steps. The fictitious scenario (simulate.R) draws outcomes onto it.
//
// Usage: npx tsx analysis/design.ts N > design.csv
// Participants are numbered in run order, so participant n gets group n mod 6 and round floor(n / 6), as
// study-harness/scripts/run-session.sh assigns them when sessions run one after another.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSessionPlan } from "@beacon/shared";
import { makeStoryLoader } from "../study-harness/server/src/trial.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadStory = makeStoryLoader(path.join(root, "study-harness/trials"), path.join(root, "captures"));
const n = Number(process.argv[2] ?? 30);
if (!Number.isInteger(n) || n < 1) throw new Error("usage: design.ts N");

const rows = ["participant_id,study_seed,group,position,story,regime,variant,milestoneStep,flawStep,pauseStep,flawStepReviewed"];
for (let i = 0; i < n; i++) {
  const plan = generateSessionPlan({ participantId: `P${String(i + 1).padStart(2, "0")}`, studySeed: String(1000 + i), group: i % 6, round: Math.floor(i / 6) });
  for (const t of plan.trials) {
    const story = loadStory(t.story);
    const pauseStep = story.pauseStep(t.regime, t.pauseDraw);
    const reviewed = t.regime === "BATCH" ? [1, 4] : [pauseStep, pauseStep];
    const flawStepReviewed = story.flawStep !== null && story.flawStep >= reviewed[0]! && story.flawStep <= reviewed[1]!;
    rows.push([plan.participantId, plan.studySeed, plan.group, t.position, t.story, t.regime, t.variant, story.milestoneStep, story.flawStep, pauseStep, flawStepReviewed].join(","));
  }
}
console.log(rows.join("\n"));
