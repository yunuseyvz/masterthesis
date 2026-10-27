import { z } from "zod";

/** Understanding questions per story (the main outcome): one per agent step, in step order. */
export const UNDERSTANDING_ITEMS = 4;

/**
 * BATCH: review once at the end (reference). MILESTONE: pause after the step that meets C1-C3.
 * NON_MILESTONE: pause after a randomly drawn step that meets none of the criteria.
 */
export const Regime = z.enum(["BATCH", "MILESTONE", "NON_MILESTONE"]);
export type Regime = z.infer<typeof Regime>;

export const Variant = z.enum(["Correct", "Flawed"]);
export type Variant = z.infer<typeof Variant>;

export const StoryId = z.enum(["US0", "US1", "US2", "US3", "US4", "US5", "US6"]);
export type StoryId = z.infer<typeof StoryId>;

export const Decision = z.enum(["accept", "reject"]);
export type Decision = z.infer<typeof Decision>;

/** Confidence that an answer is right, 50 % (guessing between two) to 100 %, in steps of 10. */
export const Confidence = z.number().int().min(50).max(100).refine((n) => n % 10 === 0, "steps of 10");

/** Oversight styles participants can tell apart; MILESTONE and NON_MILESTONE both look like a pause. */
export const Style = z.enum(["END", "PAUSE"]);
export type Style = z.infer<typeof Style>;

/** One measured trial as assigned by the session generator. */
export const TrialPlan = z.object({
  /** 0 = practice trial, 1-6 = measured trials. */
  position: z.number().int().min(0).max(6),
  story: StoryId,
  regime: Regime,
  variant: Variant,
  /** Permutation of option indices 0..3 used to display the probe options. */
  probeOptionOrder: z.array(z.number().int().min(0).max(3)).length(4),
  /** One permutation of the four options per understanding item. */
  understandingOptionOrders: z.array(z.array(z.number().int().min(0).max(3)).length(4)).length(UNDERSTANDING_ITEMS),
  /** NON_MILESTONE only: which of the story's two non-milestone steps among 1-3 the agent pauses after. */
  pauseDraw: z.number().int().min(0).max(1),
});
export type TrialPlan = z.infer<typeof TrialPlan>;

export const SessionPlan = z.object({
  participantId: z.string().min(1),
  studySeed: z.string().regex(/^\d+$/),
  group: z.number().int().min(0).max(5),
  /** Earlier sessions of this group; balances the NON_MILESTONE pause step (absent: drawn per trial). */
  round: z.number().int().min(0).optional(),
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
  /** Step (1-3) that meets the criteria in this story. */
  milestoneStep: z.number().int().min(1).max(4),
  /** The step whose code differs between the variants (null: the practice story, which has no flaw). */
  flawStep: z.number().int().min(1).max(4).nullable(),
  /** Step after which the scored review happened (BATCH: 4, the end). */
  pauseStep: z.number().int().min(1).max(4),
  /**
   * The scored review includes the flaw step (BATCH: always; a pause: when it follows the flaw step), so a Flawed
   * trial's flaw could be seen before the decision. Set for Correct trials too, to compare like with like.
   */
  flawStepReviewed: z.boolean(),
  /** Step whose code the stage-2 question asks about (the paused step; BATCH: the flaw step). */
  probeStep: z.number().int().min(1).max(3),
  initialDecision: Decision,
  finalDecision: Decision,
  decisionReversed: z.boolean(),
  /** Lines of code in the scored review (the diff the participant decided on). */
  reviewedLines: z.number().int().nonnegative(),
  /** Time from the plan being shown to "Approve plan". */
  planMs: z.number().nonnegative(),
  /** Time from the pause to the accept/reject decision. */
  stage1DwellMs: z.number().nonnegative(),
  /** Before the decision: time the changes view was open, furthest point scrolled in its diff (0-1; 0 = never opened). */
  changesViewMsStage1: z.number().nonnegative(),
  diffCoverageStage1: z.number().min(0).max(1),
  /** Before the decision: distinct files opened in the changes view, terminal commands, and test runs among them. */
  filesOpenedStage1: z.number().int().nonnegative(),
  terminalCommandsStage1: z.number().int().nonnegative(),
  testRunsStage1: z.number().int().nonnegative(),
  /** Before the decision: test runs that reported at least one failing test. */
  testFailRunsStage1: z.number().int().nonnegative(),
  /**
   * Before the decision: hunks (changed regions) in the reviewed diff, and how many were on screen for at least 1 s.
   * The flaw region is the lines that differ between the Correct and Flawed variant (in both variants, so the Correct
   * trials give the baseline); its time on screen and whether it was on screen for at least 1 s. 0/false when the
   * region does not exist yet at this point (the flaw step comes later) or the story has none.
   */
  hunksStage1: z.number().int().nonnegative(),
  hunksViewedStage1: z.number().int().nonnegative(),
  flawRegionMsStage1: z.number().nonnegative(),
  flawRegionSeenStage1: z.boolean(),
  /** Before the decision: time the study window was not focused, and time without any input for 30 s or more. */
  unfocusedMsStage1: z.number().nonnegative(),
  idleMsStage1: z.number().nonnegative(),
  /** Before the decision: times the chat was scrolled back, and tool calls expanded in it (reading the agent's account). */
  chatScrollBacksStage1: z.number().int().nonnegative(),
  toolExpandsStage1: z.number().int().nonnegative(),
  /** While answering the behaviour question: terminal commands (running the code to check). */
  terminalCommandsProbe: z.number().int().nonnegative(),
  stage2ProbeLatencyMs: z.number().nonnegative(),
  probeAnswer: z.number().int().min(-1).max(3), // -1 = "I don't know"
  probeCorrect: z.boolean(),
  /** Canonical option index chosen for each understanding item. */
  understandingAnswers: z.array(z.number().int().min(0).max(3)).length(UNDERSTANDING_ITEMS),
  understandingCorrects: z.array(z.boolean()).length(UNDERSTANDING_ITEMS),
  /** Confidence in each understanding answer, 50-100 % in steps of 10. */
  understandingConfidences: z.array(Confidence).length(UNDERSTANDING_ITEMS),
  /** Number of correct understanding items, 0..UNDERSTANDING_ITEMS. */
  understandingScore: z.number().int().min(0).max(UNDERSTANDING_ITEMS),
  /** Time from the finished feature being shown to "I've reviewed", and how long the changes view was open in it. */
  finalReviewMs: z.number().nonnegative(),
  changesViewMsFinal: z.number().nonnegative(),
  /** The same measures for the final review (the changes view then shows the steps after the pause; BATCH: all). */
  hunksFinal: z.number().int().nonnegative(),
  hunksViewedFinal: z.number().int().nonnegative(),
  flawRegionMsFinal: z.number().nonnegative(),
  flawRegionSeenFinal: z.boolean(),
  unfocusedMsFinal: z.number().nonnegative(),
  idleMsFinal: z.number().nonnegative(),
  /** Time on each understanding question's screen (ms) and how often its answer was changed. */
  understandingItemMs: z.array(z.number().nonnegative()).length(UNDERSTANDING_ITEMS),
  understandingAnswerChanges: z.array(z.number().int().nonnegative()).length(UNDERSTANDING_ITEMS),
  /** Paas mental effort for this feature, 1-9. */
  paas: z.number().int().min(1).max(9),
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
