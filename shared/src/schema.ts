import { z } from "zod";

export const Regime = z.enum(["BATCH", "ARBITRARY", "PAIR_PROG"]);
export type Regime = z.infer<typeof Regime>;

export const Variant = z.enum(["Correct", "Flawed"]);
export type Variant = z.infer<typeof Variant>;

export const StoryId = z.enum(["US0", "US1", "US2", "US3", "US4", "US5", "US6"]);
export type StoryId = z.infer<typeof StoryId>;

export const Decision = z.enum(["accept", "reject"]);
export type Decision = z.infer<typeof Decision>;

/** One measured trial as assigned by the session generator. */
export const TrialPlan = z.object({
  /** 0 = practice trial, 1-6 = measured trials. */
  position: z.number().int().min(0).max(6),
  story: StoryId,
  regime: Regime,
  variant: Variant,
  /** Permutation of option indices 0..3 used to display the probe options. */
  probeOptionOrder: z.array(z.number().int().min(0).max(3)).length(4),
  understandingOptionOrder: z.array(z.number().int().min(0).max(3)).length(4),
});
export type TrialPlan = z.infer<typeof TrialPlan>;

export const SessionPlan = z.object({
  participantId: z.string().min(1),
  studySeed: z.string().regex(/^\d+$/),
  group: z.number().int().min(0).max(5),
  /** Unmeasured practice trial shown first. */
  practice: TrialPlan,
  trials: z.array(TrialPlan).length(6),
});
export type SessionPlan = z.infer<typeof SessionPlan>;

/** Per-trial result row (one line in trials.csv). */
export const TrialResult = z.object({
  position: z.number().int(),
  story: StoryId,
  regime: Regime,
  variant: Variant,
  initialDecision: Decision,
  finalDecision: Decision,
  decisionReversed: z.boolean(),
  stage1DwellMs: z.number().nonnegative(),
  diffScrollCoverage: z.number().min(0).max(1),
  testRunsStage1: z.number().int().nonnegative(),
  stage2ProbeLatencyMs: z.number().nonnegative(),
  probeAnswer: z.number().int().min(-1).max(3), // -1 = "I don't know"
  probeCorrect: z.boolean(),
  understandingAnswer: z.number().int().min(0).max(3),
  understandingCorrect: z.boolean(),
  confidence: z.number().int().min(1).max(7),
  mentalDemand: z.number().int().min(1).max(5),
  frustration: z.number().int().min(1).max(5),
});
export type TrialResult = z.infer<typeof TrialResult>;

export const SessionBundle = z.object({
  plan: SessionPlan,
  trials: z.array(TrialResult).length(6),
  practice: TrialResult.optional(),
  /** Raw event log: authoritative source for any re-derivation. */
  events: z.array(z.object({ t: z.number(), type: z.string(), data: z.unknown() })),
  survey: z.record(z.unknown()),
});
export type SessionBundle = z.infer<typeof SessionBundle>;
