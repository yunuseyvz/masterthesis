import fs from "node:fs";
import path from "node:path";
import type { SessionBundle, TrialResult } from "@beacon/shared";
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
  "position", "story", "regime", "variant", "initialDecision", "finalDecision", "decisionReversed",
  "stage1DwellMs", "diffScrollCoverage", "testRunsStage1", "stage2ProbeLatencyMs", "probeAnswer",
  "probeCorrect", "understandingAnswer", "understandingCorrect", "confidence", "mentalDemand", "frustration",
];

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
    [participantId, studySeed, bundle.plan.group, ...CSV_COLUMNS.map((c) => t[c])].join(","),
  );
  const out = (header ? ["participant_id,study_seed,group," + CSV_COLUMNS.join(",")] : []).concat(lines).join("\n") + "\n";
  const cfd = fs.openSync(csvPath, "a");
  fs.writeSync(cfd, out);
  fs.fsyncSync(cfd);
  fs.closeSync(cfd);
}
