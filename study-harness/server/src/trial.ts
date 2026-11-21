import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ItemRole, UNDERSTANDING_ITEMS, type Regime, type Variant } from "@beacon/shared";

const Four = z.tuple([z.string(), z.string(), z.string(), z.string()]);

export const TrialDef = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/),
  title: z.string(),
  project: z.string().regex(/^[a-z][a-z0-9-]*$/),
  brief: z.string().min(1),
  steps: z
    .array(
      z.object({
        n: z.number().int().min(1).max(4),
        kind: z.enum(["scaffold", "milestone", "completion"]),
        // declarative step: nothing to review or run, so no NON_MILESTONE pause follows it
        declarative: z.boolean().default(false),
        summary: z.string(),
      }),
    )
    .length(4),
  flawStep: z.number().int().min(1).max(3).nullable(),
  testFile: z.string(),
  outline: z.object({ Correct: z.string(), Flawed: z.string() }),
  publicPlan: z.string(),
  // phrases that state a design decision; the public plan must not contain them and agent text is checked for them (live_text_leak)
  planLeaks: z.array(z.string()).default([]),
  probes: z
    .array(
      z.object({
        step: z.number().int().min(1).max(3),
        question: z.string(),
        options: Four,
        script: z.string(),
        expected: z.object({ Correct: z.string(), Flawed: z.string() }),
      }),
    )
    .length(3),
  understanding: z.object({
    script: z.string(),
    items: z
      .array(
        z.object({
          step: z.number().int().min(1).max(4),
          role: ItemRole,
          question: z.string(),
          options: Four,
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
  brief: string;
  publicPlan: string;
  milestoneStep: number;
  flawStep: number | null;
  files(): Map<string, string>;
  // first step whose reference implementation writes the file (both variants)
  fileSteps(): Map<string, number>;
  probeFor(regime: Regime, pauseStep: number): TrialDef["probes"][number];
  // BATCH: 4; NON_MILESTONE: a step in 1-3 that is neither milestone nor declarative, per pauseDraw
  pauseStep(regime: Regime, pauseDraw: number): number;
  probeScript(probe: TrialDef["probes"][number]): string;
  understandingScript(): string;
  drehbuch(variant: Variant): string;
}

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
  const items = def.understanding.items;
  if (items.some((it, k) => k > 0 && it.step < items[k - 1]!.step)) throw new Error(where("understanding items must be listed in step order"));
  const roles = ["open-case", "dependency", def.flawStep === null ? "behaviour" : "flaw", "interplay", "emergent"];
  if (items.map((it) => it.role).sort().join() !== roles.sort().join()) throw new Error(where(`understanding items must have the roles ${roles.join(", ")}, each once`));
  const roleStep = (role: ItemRole) => items.find((it) => it.role === role)!.step;
  if (roleStep("open-case") !== milestoneStep) throw new Error(where("the open-case item must ask about the milestone step"));
  if (def.flawStep !== null && roleStep("flaw") !== def.flawStep) throw new Error(where("the flaw item must ask about the flaw step"));
  const rules = fs.readFileSync(path.join(trialsDir, "drehbuch.md"), "utf8").trim();
  const outlines = { Correct: read(def.outline.Correct).trim(), Flawed: read(def.outline.Flawed).trim() };
  // A NON_MILESTONE pause follows a step with behaviour of its own, like the milestone; the flaw and the milestone
  // are in such steps.
  const declarative = (n: number) => def.steps[n - 1]!.declarative;
  if (declarative(milestoneStep)) throw new Error(where("the milestone step must not be declarative"));
  if (def.flawStep !== null && declarative(def.flawStep)) throw new Error(where("the flaw step must not be declarative"));
  const nonMilestoneSteps = [1, 2, 3].filter((n) => n !== milestoneStep && !declarative(n));
  if (nonMilestoneSteps.length === 0) throw new Error(where("a NON_MILESTONE pause needs a step among 1-3 that is neither the milestone nor declarative"));
  let project: Map<string, string> | null = null;
  let owners: Map<string, number> | null = null;
  const fileSteps = () => {
    if (owners) return owners;
    owners = new Map();
    for (let n = 1; n <= 4; n++)
      for (const v of ["Correct", "Flawed"]) {
        const d = path.join(dir, "reference", v, `step${n}`);
        if (fs.existsSync(d)) for (const f of readTree(d).keys()) if (!owners.has(f)) owners.set(f, n);
      }
    return owners;
  };

  return {
    def,
    dir,
    brief: def.brief,
    publicPlan: read(def.publicPlan).trim(),
    milestoneStep,
    flawStep: def.flawStep,
    files: () => (project ??= readTree(projectDir)),
    fileSteps,
    probeFor(regime, pauseStep) {
      const step = regime === "BATCH" ? (def.flawStep ?? milestoneStep) : pauseStep;
      return def.probes[step - 1]!;
    },
    pauseStep(regime, pauseDraw) {
      if (regime === "BATCH") return 4;
      if (regime === "MILESTONE") return milestoneStep;
      // With one candidate step the draw does not matter.
      return nonMilestoneSteps[pauseDraw % nonMilestoneSteps.length]!;
    },
    probeScript: (probe) => read(probe.script),
    understandingScript: () => read(def.understanding.script),
    drehbuch: (variant) => `${rules}\n\n${outlines[variant]}\n`,
  };
}

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
