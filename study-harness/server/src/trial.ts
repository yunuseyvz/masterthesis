import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UNDERSTANDING_ITEMS, parseChunks, type Regime, type Variant } from "@beacon/shared";
import { loadCapture, type LoadedCapture } from "./captures.js";
import { changedLines, toRanges, type Region } from "./lines.js";

export interface DiffFile {
  path: string;
  before: string;
  after: string;
}

/**
 * A change to one recorded tool call: in the call's arguments, `find` (which must occur exactly once in its string
 * values) becomes `replace`. The file the call writes or edits (`path` argument) changes the same way from then on.
 */
export const Patch = z.object({
  /** Main-thread position of the response. */
  position: z.number().int().nonnegative(),
  /** Index of the tool call in that response. */
  tool: z.number().int().nonnegative(),
  find: z.string().min(1),
  replace: z.string(),
});
export type Patch = z.infer<typeof Patch>;

const Four = z.tuple([z.string(), z.string(), z.string(), z.string()]);

/**
 * A trial (study-harness/trials/<id>/trial.json): a capture plus everything the study adds to it. The capture is replayed
 * as recorded; the trial says where its four steps start (the places a checkpoint can go), which variant patch makes
 * the Flawed (or Correct) code, and what the participant is asked.
 */
export const TrialDef = z.object({
  /** The trial folder's name; a session plays the trials named US0-US6. */
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/),
  /** Capture folder name under the captures directory. */
  capture: z.string(),
  title: z.string(),
  /** Repository name shown in the sidebar and terminal. */
  project: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** The recorded turn sent when the participant approves the plan (turn 0, the request, is sent at the start). */
  approveTurn: z.number().int().min(1).default(1),
  steps: z
    .array(
      z.object({
        n: z.number().int().min(1).max(4),
        kind: z.enum(["scaffold", "milestone", "completion"]),
        summary: z.string(),
        /** Main-thread position of the step's first response; a checkpoint after the previous step stops right before it. */
        start: z.number().int().nonnegative(),
      }),
    )
    .length(4),
  /** Patches that turn the capture into each variant (usually one of the two is the capture as recorded: []). */
  variants: z.object({ Correct: z.array(Patch), Flawed: z.array(Patch) }),
  testFile: z.string(),
  /**
   * One stage-2 behaviour question per step a pause can follow (1-3), about that step's code. BATCH, which reviews
   * everything, asks the question for the step with the flaw.
   */
  probes: z
    .array(
      z.object({
        step: z.number().int().min(1).max(3),
        question: z.string(),
        options: Four,
        script: z.string(),
        /** What the probe script prints for each variant; must be one of `options`. */
        expected: z.object({ Correct: z.string(), Flawed: z.string() }),
      }),
    )
    .length(3),
  understanding: z.object({
    /** Prints a JSON array with the true option text of every item, computed by running the trial's code. */
    script: z.string(),
    items: z
      .array(
        z.object({
          /** Agent step (1-4) whose code decides the answer; items are listed in step order. */
          step: z.number().int().min(1).max(4),
          question: z.string(),
          options: Four,
          correct: z.object({ Correct: z.number().int().min(0).max(3), Flawed: z.number().int().min(0).max(3) }),
        }),
      )
      .length(UNDERSTANDING_ITEMS),
  }),
});
export type TrialDef = z.infer<typeof TrialDef>;

/** Replaces the one occurrence of `find`; anything else is an authoring error. */
function replaceOnce(content: string, find: string, replace: string, where: string): string {
  const at = content.indexOf(find);
  if (at < 0 || content.indexOf(find, at + 1) >= 0) throw new Error(`${where}: patch text must occur exactly once: ${JSON.stringify(find.slice(0, 60))}`);
  return content.slice(0, at) + replace + content.slice(at + find.length);
}

/** A tool call's JSON arguments with a patch applied to the string value that contains its text. */
export function patchArgs(args: string, p: Patch): string {
  const obj = JSON.parse(args) as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => typeof obj[k] === "string" && (obj[k] as string).includes(p.find));
  if (keys.length !== 1) throw new Error(`patch at @${p.position} tool ${p.tool}: text found in ${keys.length} arguments`);
  obj[keys[0]!] = replaceOnce(obj[keys[0]!] as string, p.find, p.replace, `patch at @${p.position}`);
  return JSON.stringify(obj);
}

export interface Story {
  def: TrialDef;
  dir: string;
  capture: LoadedCapture;
  /** The participant's request (the capture's first turn). */
  brief: string;
  /** Number (1-3) of the step marked `milestone`; it differs between stories. */
  milestoneStep: number;
  /** The step whose code differs between the variants (it contains the patch); null when there is none (practice). */
  flawStep: number | null;
  /** The stage-2 question asked after a review that ends at `pauseStep` (BATCH: the flaw step's question). */
  probeFor(regime: Regime, pauseStep: number): TrialDef["probes"][number];
  /** Step after which the scored review happens for a regime (BATCH: 4). */
  pauseStep(regime: Regime, pauseDraw: number): number;
  /** Main-thread position a checkpoint after `step` stops before (null after step 4: the end of the capture). */
  boundary(step: number): number | null;
  patches(variant: Variant): Patch[];
  /** The project after the response at main-thread `position` and its tool calls (what the replay leaves on disk). */
  filesAfter(variant: Variant, position: number): Map<string, string>;
  /** The project after agent step `upTo` (0: before step 1). */
  workspaceAt(variant: Variant, upTo: number): Map<string, string>;
  /** Files changed in steps from..to, with content before `from` and after `to`. */
  diff(variant: Variant, from: number, to: number): DiffFile[];
  /** The hunks of that diff (changed lines, merged like git's), in line numbers of the files after step `to`. */
  hunks(variant: Variant, from: number, to: number): Region[];
  /** The lines that differ between the variants, in this variant's files after step `upTo` (empty before the flaw step). */
  flawRegion(variant: Variant, upTo: number): Region[];
  probeScript(probe: TrialDef["probes"][number]): string;
  understandingScript(): string;
}

export function loadStory(trialsDir: string, capturesDir: string, id: string): Story {
  const dir = path.join(trialsDir, id);
  const def = TrialDef.parse(JSON.parse(fs.readFileSync(path.join(dir, "trial.json"), "utf8")));
  if (def.id !== id) throw new Error(`trial ${id}: trial.json says id ${def.id}`);
  const capture = loadCapture(path.join(capturesDir, def.capture));
  const { main } = capture;
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  const where = (s: string) => `${id}: ${s}`;

  const milestones = def.steps.filter((s) => s.kind === "milestone");
  if (milestones.length !== 1) throw new Error(where(`exactly one step must be the milestone, found ${milestones.length}`));
  const milestoneStep = milestones[0]!.n;
  if (milestoneStep > 3) throw new Error(where("the milestone must be step 1, 2 or 3 so that a pause after it is mid-run"));
  const starts = def.steps.map((s) => s.start);
  if (starts.some((s, i) => i > 0 && s <= starts[i - 1]!)) throw new Error(where("step starts must increase"));
  if (starts.at(-1)! >= main.length) throw new Error(where(`step 4 starts at @${starts.at(-1)}, the capture has ${main.length} responses`));
  if (def.probes.map((p) => p.step).join() !== "1,2,3") throw new Error(where("probes must cover steps 1-3 in order"));
  if (def.understanding.items.map((it) => it.step).join() !== "1,2,3,4") throw new Error(where("understanding items must cover steps 1-4 in order"));
  if (def.approveTurn >= capture.capture.turns.length) throw new Error(where(`the capture has no turn ${def.approveTurn} to approve the plan with`));

  const stepOf = (position: number) => [...def.steps].reverse().find((s) => s.start <= position)?.n ?? 0;
  const patched = [...def.variants.Correct, ...def.variants.Flawed];
  const flawSteps = [...new Set(patched.map((p) => stepOf(p.position)))];
  if (flawSteps.length > 1 || flawSteps[0] === 0) throw new Error(where("variant patches must all lie in one step"));
  const nonMilestoneSteps = [1, 2, 3].filter((n) => n !== milestoneStep);

  const callAt = (position: number) => {
    const c = main[position];
    if (!c || c.position !== position) throw new Error(where(`no main-thread response at @${position}`));
    return c;
  };
  const patchTarget = (p: Patch) => {
    const tool = parseChunks(callAt(p.position).chunks).tools[p.tool];
    if (!tool) throw new Error(where(`no tool call ${p.tool} at @${p.position}`));
    const args = JSON.parse(tool.args) as { path?: string; filePath?: string };
    const file = args.path ?? args.filePath;
    if (!file) throw new Error(where(`tool call at @${p.position} has no path`));
    patchArgs(tool.args, p); // checks the text occurs once
    return file.split(capture.capture.workspace.dir + "/").join("");
  };
  const targets = new Map(patched.map((p) => [p, patchTarget(p)]));

  /** A snapshot with the variant's patches up to (excluding) `before` applied. */
  const variantFiles = (variant: Variant, commit: string, before: number) => {
    const files = new Map(capture.files(commit));
    for (const p of def.variants[variant]) {
      if (p.position >= before) continue;
      const f = targets.get(p)!;
      files.set(f, replaceOnce(files.get(f) ?? "", p.find, p.replace, where(`${variant} patch in ${f}`)));
    }
    return files;
  };
  const filesAfter = (variant: Variant, position: number) => {
    const next = main[position + 1];
    return variantFiles(variant, next ? next.snapshot : capture.capture.workspace.final, position + 1);
  };
  const workspaceAt = (variant: Variant, upTo: number) => {
    if (upTo >= 4) return variantFiles(variant, capture.capture.workspace.final, Infinity);
    const at = def.steps[upTo]!.start;
    return variantFiles(variant, callAt(at).snapshot, at);
  };
  // Every patch must apply at every step boundary, in both variants (throws on an authoring error).
  for (const v of ["Correct", "Flawed"] as const) for (let k = 0; k <= 4; k++) workspaceAt(v, k);

  const diff = (variant: Variant, from: number, to: number): DiffFile[] => {
    const before = workspaceAt(variant, from - 1);
    const after = workspaceAt(variant, to);
    const paths = new Set([...before.keys(), ...after.keys()]);
    return [...paths].filter((p) => before.get(p) !== after.get(p)).sort().map((p) => ({ path: p, before: before.get(p) ?? "", after: after.get(p) ?? "" }));
  };

  return {
    def,
    dir,
    capture,
    brief: capture.capture.turns[0]!.text,
    milestoneStep,
    flawStep: flawSteps[0] ?? null,
    probeFor(regime, pauseStep) {
      const step = regime === "BATCH" ? (flawSteps[0] ?? milestoneStep) : pauseStep;
      return def.probes[step - 1]!;
    },
    pauseStep(regime, pauseDraw) {
      if (regime === "BATCH") return 4;
      if (regime === "MILESTONE") return milestoneStep;
      return nonMilestoneSteps[pauseDraw]!;
    },
    boundary: (step) => (step >= 4 ? null : def.steps[step]!.start),
    patches: (variant) => def.variants[variant],
    filesAfter,
    workspaceAt,
    diff,
    hunks(variant, from, to) {
      return diff(variant, from, to).flatMap((d) => toRanges(changedLines(d.before, d.after), 6).map((r) => ({ file: d.path, ...r })));
    },
    flawRegion(variant, upTo) {
      const step = flawSteps[0];
      if (step === undefined || step > upTo) return [];
      const other = variant === "Correct" ? "Flawed" : "Correct";
      const mine = workspaceAt(variant, upTo);
      const theirs = workspaceAt(other, upTo);
      const files = [...new Set(patched.map((p) => targets.get(p)!))];
      return files.flatMap((p) => toRanges(changedLines(theirs.get(p) ?? "", mine.get(p) ?? "")).map((r) => ({ file: p, ...r })));
    },
    probeScript: (probe) => read(probe.script),
    understandingScript: () => read(def.understanding.script),
  };
}

/** Loads trials lazily. */
export function makeStoryLoader(trialsDir: string, capturesDir: string) {
  const cache = new Map<string, Story>();
  return (id: string): Story => {
    const hit = cache.get(id);
    if (hit) return hit;
    const story = loadStory(trialsDir, capturesDir, id);
    cache.set(id, story);
    return story;
  };
}
