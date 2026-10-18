import { z } from "zod";
import { Regime, type Decision } from "./schema.js";

/** What the client may see. Never contains variant, ground truth, or regime. */

export type Phase = "intro" | "presurvey" | "postsurvey" | "stage1" | "unscored" | "stage2" | "understanding" | "debrief" | "finished";

export interface DiffFile {
  path: string;
  before: string;
  after: string;
}

export interface CheckpointView {
  id: string;
  scored: boolean;
  diffs: DiffFile[];
  /** Full workspace at this checkpoint, for read-only context. */
  workspace: { path: string; content: string }[];
}

export interface ViewState {
  phase: Phase;
  participantId: string;
  /** 1-based position in the session (the practice trial is 1); 0 before the first trial. */
  trial: number;
  /** Number of measured trials (excludes practice). */
  nTrials: number;
  practice: boolean;
  /** Sessions started so far (the sidebar), one per story/project. */
  sessions: { trial: number; title: string; project: string }[];
  story?: { title: string; brief: string; project: string };
  /** Agent steps covered by the current checkpoint. */
  agentSteps?: { n: number; summary: string; files: string[] }[];
  checkpoint?: CheckpointView;
  initialDecision?: Decision;
  probe?: { question: string; options: string[] };
  understanding?: { question: string; options: string[] };
}

export const Demographics = z.object({
  ageGroup: z.enum(["18-24", "25-34", "35-44", "45-54", "55+", "no-answer"]),
  programmingYears: z.enum(["<1", "1-3", "3-5", "5-10", "10+"]),
  aiAssistantUse: z.enum(["never", "rarely", "monthly", "weekly", "daily"]),
  codeReviewFrequency: z.enum(["never", "rarely", "monthly", "weekly", "daily"]),
  tsFamiliarity: z.number().int().min(1).max(5),
});
export type Demographics = z.infer<typeof Demographics>;

const Percent = z.number().int().min(0).max(100).refine((n) => n % 5 === 0, "steps of 5");

export const Tlx = z.object({
  mental: Percent,
  physical: Percent,
  temporal: Percent,
  performance: Percent,
  effort: Percent,
  frustration: Percent,
});
export type Tlx = z.infer<typeof Tlx>;

const Scale = (max: number) => z.number().int().min(1).max(max);

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("begin") }),
  z.object({
    type: z.literal("presurvey"),
    consent: z.literal(true),
    demographics: Demographics,
    /** NCS-6 items in presented order, 1-5 (items 3 and 4 are reverse-keyed on the server). */
    ncs: z.array(z.number().int().min(1).max(5)).length(6),
    /** Instructed-response attention check, 1-5. */
    attention: z.number().int().min(1).max(5),
    /** S-TIAS items in presented order, 1-7. */
    stias: z.array(z.number().int().min(1).max(7)).length(3),
  }),
  /** Client finished replaying the agent's work and the checkpoint is now actually on screen. */
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("stage1"), decision: z.enum(["accept", "reject"]), scrollCoverage: z.number().min(0).max(1) }),
  z.object({
    type: z.literal("postsurvey"),
    /** Raw NASA-TLX, 0-100 in steps of 5. Performance: 0 = perfect, 100 = failure (original orientation). */
    tlx: Tlx,
    /** Paas mental-effort scale, 1-9. */
    paas: Scale(9),
    /** Preferred oversight style, best first. */
    ranking: z.array(Regime).length(3).refine((r) => new Set(r).size === 3, "each regime once"),
    comment: z.string().max(2000).optional(),
  }),
  z.object({ type: z.literal("advance") }),
  z.object({
    type: z.literal("stage2"),
    /** Index into the displayed options, or -1 for "I don't know". */
    probeAnswer: z.number().int().min(-1).max(3),
    final: z.enum(["confirm", "reverse"]),
  }),
  z.object({
    type: z.literal("understanding"),
    answer: z.number().int().min(0).max(3),
    confidence: Scale(7),
    mentalDemand: Scale(5),
    frustration: Scale(5),
  }),
]);
export type Action = z.infer<typeof Action>;
