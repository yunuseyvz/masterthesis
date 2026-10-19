import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { StoryId, UNDERSTANDING_ITEMS, type Variant, type DiffFile } from "@beacon/shared";

const Source = z.union([z.string(), z.object({ Correct: z.string(), Flawed: z.string() })]);
const Four = z.tuple([z.string(), z.string(), z.string(), z.string()]);

export const StoryDef = z.object({
  id: StoryId,
  /** Repository name shown in the sidebar, terminal prompt and package.json. */
  project: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Name of a shared codebase under `corpus/_base/` that exists before the agent starts; its files are never part of a diff. */
  base: z.string().optional(),
  title: z.string(),
  brief: z.string(),
  steps: z
    .array(
      z.object({
        n: z.number().int().min(1).max(4),
        kind: z.enum(["scaffold", "milestone", "completion"]),
        summary: z.string(),
        narration: z.string().optional(),
        files: z.array(z.object({ path: z.string(), source: Source })),
      }),
    )
    .length(4),
  testFile: z.string(),
  testsAvailableFromStep: z.number().int().min(1).max(4),
  probe: z.object({
    question: z.string(),
    options: Four,
    script: z.string(),
    /** What the probe script prints for each variant; must be one of `options`. */
    expected: z.object({ Correct: z.string(), Flawed: z.string() }),
  }),
  understanding: z.object({
    /** Prints a JSON array with the true option text of every item, computed by running the story's code. */
    script: z.string(),
    items: z
      .array(
        z.object({
          question: z.string(),
          options: Four,
          correct: z.object({ Correct: z.number().int().min(0).max(3), Flawed: z.number().int().min(0).max(3) }),
        }),
      )
      .length(UNDERSTANDING_ITEMS),
  }),
});
export type StoryDef = z.infer<typeof StoryDef>;

const packageJson = (name: string) =>
  JSON.stringify({ name, private: true, type: "module", scripts: { test: 'node --test "test/**/*.test.ts"' } }, null, 2) + "\n";

export interface Story {
  def: StoryDef;
  dir: string;
  /** Number (1-4) of the step marked `milestone`; it differs between stories. */
  milestoneStep: number;
  /** Workspace contents after agent step `upTo` (0 = empty). */
  workspaceAt(variant: Variant, upTo: number): Map<string, string>;
  /** Files touched in steps from..to, with content before `from` and after `to`. */
  diff(variant: Variant, from: number, to: number): DiffFile[];
  /** Files needed to run the test suite / probe (everything through the step where the tests become available + the test file). */
  testWorkspace(variant: Variant): Map<string, string>;
  /** What the participant sees in the file tree and can use in the terminal at a checkpoint after step `toStep`. */
  projectWorkspace(variant: Variant, toStep: number): Map<string, string>;
  probeScript(): string;
  understandingScript(): string;
}

function readTree(root: string, rel = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) for (const [p, c] of readTree(root, r)) out.set(p, c);
    else out.set(r, fs.readFileSync(path.join(root, r), "utf8"));
  }
  return out;
}

export function loadStory(corpusDir: string, id: string): Story {
  const dir = path.join(corpusDir, id);
  const def = StoryDef.parse(JSON.parse(fs.readFileSync(path.join(dir, "story.json"), "utf8")));
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  const pick = (src: z.infer<typeof Source>, v: Variant) => read(typeof src === "string" ? src : src[v]);
  const milestones = def.steps.filter((s) => s.kind === "milestone");
  if (milestones.length !== 1) throw new Error(`${id}: exactly one step must be the milestone, found ${milestones.length}`);
  const baseFiles = def.base ? readTree(path.join(corpusDir, "_base", def.base)) : new Map<string, string>();

  const workspaceAt = (variant: Variant, upTo: number) => {
    const ws = new Map<string, string>(baseFiles);
    for (const step of def.steps) {
      if (step.n > upTo) break;
      for (const f of step.files) ws.set(f.path, pick(f.source, variant));
    }
    return ws;
  };

  return {
    def,
    dir,
    milestoneStep: milestones[0]!.n,
    workspaceAt,
    diff(variant, from, to) {
      const before = workspaceAt(variant, from - 1);
      const after = workspaceAt(variant, to);
      const touched = new Set<string>();
      for (const step of def.steps) if (step.n >= from && step.n <= to) step.files.forEach((f) => touched.add(f.path));
      return [...touched].map((p) => ({ path: p, before: before.get(p) ?? "", after: after.get(p) ?? "" }));
    },
    testWorkspace(variant) {
      const ws = workspaceAt(variant, def.testsAvailableFromStep);
      const testStep = def.steps.find((s) => s.files.some((f) => f.path === def.testFile));
      const testSrc = testStep?.files.find((f) => f.path === def.testFile)?.source;
      if (testSrc === undefined) throw new Error(`testFile ${def.testFile} not declared in any step`);
      ws.set(def.testFile, pick(testSrc, variant));
      return ws;
    },
    projectWorkspace(variant, toStep) {
      const ws = new Map<string, string>([["package.json", packageJson(def.project)]]);
      // Static project README: how to run things only, never boundary behaviour (that would be the spec).
      if (!def.base && fs.existsSync(path.join(dir, "README.md"))) ws.set("README.md", read("README.md"));
      for (const [p, c] of workspaceAt(variant, toStep)) ws.set(p, c);
      // The happy-path suite is treated as part of the repo once the code it covers exists,
      // so `npm test` works at every checkpoint where there is something to test.
      if (toStep >= def.testsAvailableFromStep && !ws.has(def.testFile)) ws.set(def.testFile, this.testWorkspace(variant).get(def.testFile)!);
      return ws;
    },
    probeScript: () => read(def.probe.script),
    understandingScript: () => read(def.understanding.script),
  };
}

/** Loads stories lazily. With `fallbackId`, missing stories reuse that story (dev only). */
export function makeStoryLoader(corpusDir: string, fallbackId?: string) {
  const cache = new Map<string, Story>();
  return (id: string): Story => {
    const hit = cache.get(id);
    if (hit) return hit;
    const useFallback = !fs.existsSync(path.join(corpusDir, id)) && fallbackId !== undefined;
    if (useFallback) console.warn(`[corpus] ${id} missing, using ${fallbackId} (dev fallback)`);
    const story = loadStory(corpusDir, useFallback ? fallbackId! : id);
    cache.set(id, story);
    return story;
  };
}
