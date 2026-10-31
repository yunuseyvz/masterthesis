import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UNDERSTANDING_ITEMS, type Regime, type Variant } from "@beacon/shared";

const Four = z.tuple([z.string(), z.string(), z.string(), z.string()]);

/**
 * A trial (study-harness/trials/<id>/trial.json): a user story the agent implements live in the shared project, in
 * four steps, from a step outline per variant; and what the participant is asked about it.
 */
export const TrialDef = z.object({
  /** The trial folder's name; a session plays the trials named US0-US6. */
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/),
  title: z.string(),
  /** Repository name shown in the sidebar and terminal. */
  project: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** The participant's request, sent for them when the trial starts; the agent answers it with its plan. */
  brief: z.string().min(1),
  steps: z
    .array(
      z.object({
        n: z.number().int().min(1).max(4),
        kind: z.enum(["scaffold", "milestone", "completion"]),
        summary: z.string(),
      }),
    )
    .length(4),
  /** The step whose outline differs between the variants (it has the flaw); null when there is none (practice). */
  flawStep: z.number().int().min(1).max(3).nullable(),
  testFile: z.string(),
  /** The step outline the agent follows, per variant (files in the trial folder); see Story.drehbuch. */
  outline: z.object({ Correct: z.string(), Flawed: z.string() }),
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
        /** What the probe script prints for each variant's reference code; must be one of `options`. */
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
          /** The answer for each variant's reference code. */
          correct: z.object({ Correct: z.number().int().min(0).max(3), Flawed: z.number().int().min(0).max(3) }),
        }),
      )
      .length(UNDERSTANDING_ITEMS),
  }),
});
export type TrialDef = z.infer<typeof TrialDef>;

export interface Story {
  def: TrialDef;
  dir: string;
  /** The participant's request. */
  brief: string;
  /** Number (1-3) of the step marked `milestone`; it differs between stories. */
  milestoneStep: number;
  flawStep: number | null;
  /** The project every trial starts from (the shared codebase), as a path → content map. */
  files(): Map<string, string>;
  /** The stage-2 question asked after a review that ends at `pauseStep` (BATCH: the flaw step's question). */
  probeFor(regime: Regime, pauseStep: number): TrialDef["probes"][number];
  /** Step after which the scored review happens for a regime (BATCH: 4). */
  pauseStep(regime: Regime, pauseDraw: number): number;
  probeScript(probe: TrialDef["probes"][number]): string;
  understandingScript(): string;
  /** The agent's script for this variant: the study's general rules (`trials/drehbuch.md`) and the step outline. */
  drehbuch(variant: Variant): string;
}

/** The files of a folder, without node_modules. */
export function readTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const p = path.join(rel, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") walk(p);
      } else out.set(p.split(path.sep).join("/"), fs.readFileSync(path.join(root, p), "utf8"));
    }
  };
  walk("");
  return out;
}

export function loadStory(trialsDir: string, projectDir: string, id: string): Story {
  const dir = path.join(trialsDir, id);
  const def = TrialDef.parse(JSON.parse(fs.readFileSync(path.join(dir, "trial.json"), "utf8")));
  if (def.id !== id) throw new Error(`trial ${id}: trial.json says id ${def.id}`);
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  const where = (s: string) => `${id}: ${s}`;

  const milestones = def.steps.filter((s) => s.kind === "milestone");
  if (milestones.length !== 1) throw new Error(where(`exactly one step must be the milestone, found ${milestones.length}`));
  const milestoneStep = milestones[0]!.n;
  if (milestoneStep > 3) throw new Error(where("the milestone must be step 1, 2 or 3 so that a pause after it is mid-run"));
  if (def.steps.map((s) => s.n).join() !== "1,2,3,4") throw new Error(where("steps must be numbered 1-4 in order"));
  if (def.probes.map((p) => p.step).join() !== "1,2,3") throw new Error(where("probes must cover steps 1-3 in order"));
  if (def.understanding.items.map((it) => it.step).join() !== "1,2,3,4") throw new Error(where("understanding items must cover steps 1-4 in order"));
  const rules = fs.readFileSync(path.join(trialsDir, "drehbuch.md"), "utf8").trim();
  const outlines = { Correct: read(def.outline.Correct).trim(), Flawed: read(def.outline.Flawed).trim() };
  const nonMilestoneSteps = [1, 2, 3].filter((n) => n !== milestoneStep);
  let project: Map<string, string> | null = null;

  return {
    def,
    dir,
    brief: def.brief,
    milestoneStep,
    flawStep: def.flawStep,
    files: () => (project ??= readTree(projectDir)),
    probeFor(regime, pauseStep) {
      const step = regime === "BATCH" ? (def.flawStep ?? milestoneStep) : pauseStep;
      return def.probes[step - 1]!;
    },
    pauseStep(regime, pauseDraw) {
      if (regime === "BATCH") return 4;
      if (regime === "MILESTONE") return milestoneStep;
      return nonMilestoneSteps[pauseDraw]!;
    },
    probeScript: (probe) => read(probe.script),
    understandingScript: () => read(def.understanding.script),
    drehbuch: (variant) => `${rules}\n\n${outlines[variant]}\n`,
  };
}

/** Loads trials lazily. */
export function makeStoryLoader(trialsDir: string, projectDir: string) {
  const cache = new Map<string, Story>();
  return (id: string): Story => {
    const hit = cache.get(id);
    if (hit) return hit;
    const story = loadStory(trialsDir, projectDir, id);
    cache.set(id, story);
    return story;
  };
}
