import fs from "node:fs";
import path from "node:path";
import { MILESTONE_ROLES, UNDERSTANDING_ITEMS, type SessionBundle, type TrialResult } from "@beacon/shared";
import type { StudyEvent, TrialCode } from "./machine.js";

// fsync per event, so a crash loses at most the one in flight
export function makeEventSink(exportDir: string, participantId: string, studySeed: string) {
  fs.mkdirSync(exportDir, { recursive: true });
  const fd = fs.openSync(path.join(exportDir, `${participantId}_${studySeed}.events.jsonl`), "a");
  return (e: StudyEvent) => {
    fs.writeSync(fd, JSON.stringify(e) + "\n");
    fs.fsyncSync(fd);
  };
}

// One line per trial as it ends. Not .json: scripts count the session bundles as *.json.
export function makeCodeArchive(exportDir: string, participantId: string, studySeed: string) {
  const file = path.join(exportDir, `${participantId}_${studySeed}.code.jsonl`);
  return (trial: TrialCode) => {
    fs.mkdirSync(exportDir, { recursive: true });
    const fd = fs.openSync(file, "a");
    fs.writeSync(fd, JSON.stringify(trial) + "\n");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  };
}

const CSV_COLUMNS: (keyof TrialResult)[] = [
  "position", "story", "regime", "variant", "milestoneStep", "flawStep", "pauseStep", "flawStepReviewed", "probeStep", "initialDecision", "finalDecision",
  "decisionReversed", "reviewedLines", "planMs", "stage1DwellMs", "changesViewMsStage1", "diffCoverageStage1",
  "filesOpenedStage1", "terminalCommandsStage1", "testRunsStage1", "testFailRunsStage1", "hunksStage1", "hunksViewedStage1",
  "unfocusedMsStage1", "idleMsStage1", "chatScrollBacksStage1", "toolExpandsStage1",
  "stage2ProbeLatencyMs", "terminalCommandsProbe", "probeAnswer", "probeCorrect", "finalReviewMs", "changesViewMsFinal",
  "hunksFinal", "hunksViewedFinal", "unfocusedMsFinal", "idleMsFinal",
  "featureComplete", "pauseMissed", "flawAtDecision", "flawAtEnd", "openCaseAsScripted", "pauseStepForced", "understandingScore", "paas", "pauseTiming", "pauseHelped", "pauseDisrupted",
];

const ITEM_COLUMNS = (n: number) =>
  Array.from({ length: n }, (_, k) => ["answer", "correct", "confidence", "role", "step", "milestone", "ms", "changes", "gradeable", "adapted"].map((c) => `u${k + 1}_${c}`)).flat();
const itemValues = (t: TrialResult) =>
  t.understandingAnswers.flatMap((a, k) => [
    a, t.understandingCorrects[k], t.understandingConfidences[k], t.understandingRoles[k], t.understandingSteps[k],
    MILESTONE_ROLES.includes(t.understandingRoles[k]!), t.understandingItemMs[k], t.understandingAnswerChanges[k],
    t.understandingGradeable[k], t.understandingAdapted[k],
  ]);

export function writeBundle(exportDir: string, bundle: SessionBundle) {
  fs.mkdirSync(exportDir, { recursive: true });
  const { participantId, studySeed } = bundle.plan;
  const target = path.join(exportDir, `${participantId}_${studySeed}.json`);
  const tmp = `${target}.tmp`;
  const fd = fs.openSync(tmp, "w");
  fs.writeSync(fd, JSON.stringify(bundle, null, 2));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, target);

  const csvPath = path.join(exportDir, "trials.csv");
  const header = !fs.existsSync(csvPath);
  const lines = bundle.trials.map((t) =>
    [participantId, studySeed, bundle.plan.group, ...CSV_COLUMNS.map((c) => t[c]), ...itemValues(t)].join(","),
  );
  const out = (header ? ["participant_id,study_seed,group," + [...CSV_COLUMNS, ...ITEM_COLUMNS(UNDERSTANDING_ITEMS)].join(",")] : []).concat(lines).join("\n") + "\n";
  const cfd = fs.openSync(csvPath, "a");
  fs.writeSync(cfd, out);
  fs.fsyncSync(cfd);
  fs.closeSync(cfd);
}
