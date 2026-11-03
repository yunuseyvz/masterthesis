import fs from "node:fs";
import path from "node:path";
import type { TrialPlan, Variant } from "@beacon/shared";
import { changedLines, toRanges, type Region } from "./lines.js";
import { readTree, type Story } from "./trial.js";

export interface DiffFile {
  path: string;
  before: string;
  after: string;
}

/**
 * A story's reference implementation (trials/<id>/reference/<variant>/step<n>/): the files each step writes when the
 * step outline is followed, for each variant. A Flawed step without a folder of its own writes what the Correct one
 * does. It checks the questions' scripts (trials.test.ts) and is what the offline agent writes (FakeAgentHost); the
 * live agent never sees it.
 */
export interface Reference {
  /** Files step `n` writes (their content after the step). */
  step(variant: Variant, n: number): Map<string, string>;
  /** The project after step `upTo` (0: as it starts). */
  workspaceAt(variant: Variant, upTo: number): Map<string, string>;
  /** Files changed in steps from..to, with content before `from` and after `to`. */
  diff(variant: Variant, from: number, to: number): DiffFile[];
  /** The hunks of that diff (changed lines, merged like git's), in line numbers of the files after step `to`. */
  hunks(variant: Variant, from: number, to: number): Region[];
}

export function loadReference(story: Story): Reference {
  const root = path.join(story.dir, "reference");
  const steps = new Map<string, Map<string, string>>();
  const step = (variant: Variant, n: number) => {
    const key = `${variant}${n}`;
    let files = steps.get(key);
    if (!files) {
      const own = path.join(root, variant, `step${n}`);
      files = readTree(fs.existsSync(own) ? own : path.join(root, "Correct", `step${n}`));
      steps.set(key, files);
    }
    return files;
  };
  const workspaceAt = (variant: Variant, upTo: number) => {
    const files = new Map(story.files());
    for (let n = 1; n <= upTo; n++) for (const [p, c] of step(variant, n)) files.set(p, c);
    return files;
  };
  const diff = (variant: Variant, from: number, to: number): DiffFile[] => {
    const before = workspaceAt(variant, from - 1);
    const after = workspaceAt(variant, to);
    const paths = new Set([...before.keys(), ...after.keys()]);
    return [...paths].filter((p) => before.get(p) !== after.get(p)).sort().map((p) => ({ path: p, before: before.get(p) ?? "", after: after.get(p) ?? "" }));
  };
  return {
    step,
    workspaceAt,
    diff,
    hunks: (variant, from, to) => diff(variant, from, to).flatMap((d) => toRanges(changedLines(d.before, d.after), 6).map((r) => ({ file: d.path, ...r }))),
  };
}

/**
 * What FakeAgentHost writes: the reference steps of the trial whose project folder is `dir` (named after the trial's
 * position, see StudySession.setUp), in the variant the session plan gives it.
 */
export function referenceSteps(loadStory: (id: string) => Story, trials: () => TrialPlan[]) {
  return (dir: string) => {
    const t = trials().find((x) => x.position === Number(path.basename(dir).slice(0, 2)))!;
    const ref = loadReference(loadStory(t.story));
    return [1, 2, 3, 4].map((n) => ref.step(t.variant, n));
  };
}
