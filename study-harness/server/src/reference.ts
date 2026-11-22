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

export interface Reference {
  step(variant: Variant, n: number): Map<string, string>;
  workspaceAt(variant: Variant, upTo: number): Map<string, string>;
  diff(variant: Variant, from: number, to: number): DiffFile[];
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

export function referenceSteps(loadStory: (id: string) => Story, trials: () => TrialPlan[]) {
  return (dir: string) => {
    const t = trials().find((x) => x.position === Number(path.basename(dir).slice(0, 2)))!;
    const ref = loadReference(loadStory(t.story));
    return [1, 2, 3, 4].map((n) => ref.step(t.variant, n));
  };
}
