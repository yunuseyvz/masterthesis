import { z } from "zod";

export const UNDERSTANDING_ITEMS = 5;

// dependency is not a milestone item: the code that decides it is usually written in a later step.
export const ItemRole = z.enum(["open-case", "dependency", "flaw", "behaviour", "interplay", "emergent"]);
export type ItemRole = z.infer<typeof ItemRole>;
export const MILESTONE_ROLES: readonly ItemRole[] = ["open-case"];

export const Regime = z.enum(["BATCH", "MILESTONE", "NON_MILESTONE"]);
export type Regime = z.infer<typeof Regime>;

export const Variant = z.enum(["Correct", "Flawed"]);
export type Variant = z.infer<typeof Variant>;

export const StoryId = z.enum(["US0", "US1", "US2", "US3", "US4", "US5", "US6"]);
export type StoryId = z.infer<typeof StoryId>;

export const Decision = z.enum(["accept", "reject"]);
export type Decision = z.infer<typeof Decision>;

// Starts at 25 (chance): a scale starting above would count guessing as overconfidence.
export const CONFIDENCE_LEVELS: readonly number[] = [25, 40, 55, 70, 85, 100];
export const Confidence = z.number().int().refine((n) => CONFIDENCE_LEVELS.includes(n), "a level of the confidence scale");

export const Style = z.enum(["END", "PAUSE"]);
export type Style = z.infer<typeof Style>;

export const TrialPlan = z.object({
  // 0 = practice trial
  position: z.number().int().min(0).max(6),
  story: StoryId,
  regime: Regime,
  variant: Variant,
  probeOptionOrder: z.array(z.number().int().min(0).max(3)).length(4),
  understandingOptionOrders: z.array(z.array(z.number().int().min(0).max(3)).length(4)).length(UNDERSTANDING_ITEMS),
  // NON_MILESTONE only; ignored when the story has one candidate step
  pauseDraw: z.number().int().min(0).max(1),
});
export type TrialPlan = z.infer<typeof TrialPlan>;

export const SessionPlan = z.object({
  participantId: z.string().min(1),
  studySeed: z.string().regex(/^\d+$/),
  group: z.number().int().min(0).max(5),
  round: z.number().int().min(0).optional(),
  practice: TrialPlan,
  trials: z.array(TrialPlan).length(6),
});
export type SessionPlan = z.infer<typeof SessionPlan>;

export const TrialResult = z.object({
  position: z.number().int(),
  story: StoryId,
  regime: Regime,
  variant: Variant,
  milestoneStep: z.number().int().min(1).max(4),
  flawStep: z.number().int().min(1).max(4).nullable(),
  pauseStep: z.number().int().min(1).max(4),
  // Also set for Correct trials, to compare like with like.
  flawStepReviewed: z.boolean(),
  probeStep: z.number().int().min(1).max(3),
  initialDecision: Decision,
  finalDecision: Decision,
  decisionReversed: z.boolean(),
  reviewedLines: z.number().int().nonnegative(),
  planMs: z.number().nonnegative(),
  stage1DwellMs: z.number().nonnegative(),
  changesViewMsStage1: z.number().nonnegative(),
  diffCoverageStage1: z.number().min(0).max(1),
  filesOpenedStage1: z.number().int().nonnegative(),
  terminalCommandsStage1: z.number().int().nonnegative(),
  testRunsStage1: z.number().int().nonnegative(),
  testFailRunsStage1: z.number().int().nonnegative(),
  // Flaw region: lines that differ between Correct and Flawed; 0/false when it does not exist yet or the story has none.
  hunksStage1: z.number().int().nonnegative(),
  hunksViewedStage1: z.number().int().nonnegative(),
  flawRegionMsStage1: z.number().nonnegative(),
  flawRegionSeenStage1: z.boolean(),
  unfocusedMsStage1: z.number().nonnegative(),
  idleMsStage1: z.number().nonnegative(),
  chatScrollBacksStage1: z.number().int().nonnegative(),
  toolExpandsStage1: z.number().int().nonnegative(),
  terminalCommandsProbe: z.number().int().nonnegative(),
  stage2ProbeLatencyMs: z.number().nonnegative(),
  probeAnswer: z.number().int().min(-1).max(3), // -1 = "I don't know"
  probeCorrect: z.boolean(),
  feedback: z.string().optional(),
  feedbackMs: z.number().nonnegative().optional(),
  // False: the understanding items asked about an unfinished feature, so the trial is excluded.
  featureComplete: z.boolean(),
  pauseMissed: z.boolean(),
  understandingRoles: z.array(ItemRole).length(UNDERSTANDING_ITEMS),
  understandingSteps: z.array(z.number().int().min(1).max(4)).length(UNDERSTANDING_ITEMS),
  understandingAnswers: z.array(z.number().int().min(0).max(3)).length(UNDERSTANDING_ITEMS),
  understandingCorrects: z.array(z.boolean()).length(UNDERSTANDING_ITEMS),
  understandingConfidences: z.array(Confidence).length(UNDERSTANDING_ITEMS),
  understandingScore: z.number().int().min(0).max(UNDERSTANDING_ITEMS),
  finalReviewMs: z.number().nonnegative(),
  changesViewMsFinal: z.number().nonnegative(),
  hunksFinal: z.number().int().nonnegative(),
  hunksViewedFinal: z.number().int().nonnegative(),
  flawRegionMsFinal: z.number().nonnegative(),
  flawRegionSeenFinal: z.boolean(),
  unfocusedMsFinal: z.number().nonnegative(),
  idleMsFinal: z.number().nonnegative(),
  understandingItemMs: z.array(z.number().nonnegative()).length(UNDERSTANDING_ITEMS),
  understandingAnswerChanges: z.array(z.number().int().nonnegative()).length(UNDERSTANDING_ITEMS),
  paas: z.number().int().min(1).max(9),
  pauseTiming: z.number().int().min(1).max(7),
  pauseHelped: z.number().int().min(1).max(7),
  pauseDisrupted: z.number().int().min(1).max(7),
});
export type TrialResult = z.infer<typeof TrialResult>;

export const SessionBundle = z.object({
  plan: SessionPlan,
  trials: z.array(TrialResult).length(6),
  practice: TrialResult.optional(),
  events: z.array(z.object({ t: z.number(), type: z.string(), data: z.unknown() })),
  survey: z.record(z.unknown()),
});
export type SessionBundle = z.infer<typeof SessionBundle>;
