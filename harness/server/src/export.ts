import fs from "node:fs";
import path from "node:path";
import { UNDERSTANDING_ITEMS, type SessionBundle, type TrialResult } from "@beacon/shared";
import type { StudyEvent } from "./machine.js";

/** Appends each event to a JSONL file with fsync, so a crash loses at most the in-flight event. */
export function makeEventSink(exportDir: string, participantId: string, studySeed: string) {
  fs.mkdirSync(exportDir, { recursive: true });
  const fd = fs.openSync(path.join(exportDir, `${participantId}_${studySeed}.events.jsonl`), "a");
  return (e: StudyEvent) => {
    fs.writeSync(fd, JSON.stringify(e) + "\n");
    fs.fsyncSync(fd);
  };
}

const CSV_COLUMNS: (keyof TrialResult)[] = [
  "position", "story", "regime", "variant", "milestoneStep", "flawStep", "pauseStep", "probeStep", "initialDecision", "finalDecision",
  "decisionReversed", "reviewedLines", "planMs", "stage1DwellMs", "changesViewMsStage1", "diffCoverageStage1",
  "filesOpenedStage1", "terminalCommandsStage1", "testRunsStage1", "testFailRunsStage1", "hunksStage1", "hunksViewedStage1",
  "flawRegionMsStage1", "flawRegionSeenStage1", "unfocusedMsStage1", "idleMsStage1", "chatScrollBacksStage1", "toolExpandsStage1",
  "stage2ProbeLatencyMs", "terminalCommandsProbe", "probeAnswer", "probeCorrect", "finalReviewMs", "changesViewMsFinal",
  "hunksFinal", "hunksViewedFinal", "flawRegionMsFinal", "flawRegionSeenFinal", "unfocusedMsFinal", "idleMsFinal",
  "understandingScore", "paas",
];

/** Per-item understanding columns (item k asks about agent step k): u1_answer, u1_correct, u1_confidence, u1_milestone, u1_ms, u1_changes, ... */
const ITEM_COLUMNS = (n: number) =>
  Array.from({ length: n }, (_, k) => ["answer", "correct", "confidence", "milestone", "ms", "changes"].map((c) => `u${k + 1}_${c}`)).flat();
const itemValues = (t: TrialResult) =>
  t.understandingAnswers.flatMap((a, k) => [
    a, t.understandingCorrects[k], t.understandingConfidences[k], k + 1 === t.milestoneStep, t.understandingItemMs[k], t.understandingAnswerChanges[k],
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
