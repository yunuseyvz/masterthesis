import type { Regime } from "@beacon/shared";

export interface CheckpointSpec {
  id: string;
  /** Exactly one checkpoint per trial is scored (two-stage flow + probe); it comes first. */
  scored: boolean;
  fromStep: number;
  toStep: number;
  /** Non-contiguous steps. When set, the checkpoint shows exactly these steps (otherwise fromStep..toStep). */
  steps?: number[];
}

export const ALL_STEPS = [1, 2, 3, 4] as const;

/** The agent steps a checkpoint shows. */
export function stepsOf(cp: CheckpointSpec): number[] {
  if (cp.steps) return cp.steps;
  const out: number[] = [];
  for (let n = cp.fromStep; n <= cp.toStep; n++) out.push(n);
  return out;
}

const wrapUp = (reviewed: number[]): CheckpointSpec[] => {
  const rest = ALL_STEPS.filter((n) => !reviewed.includes(n));
  return rest.length === 0 ? [] : [{ id: "wrap-up", scored: false, fromStep: 1, toStep: 4, steps: rest }];
};

/**
 * Each checkpoint shows the diff since the previous pause (or since the start).
 *  BATCH:      (control) one scored pause on the finished work (steps 1-4).
 *  CHECKPOINT:  (intervention) the steps before the milestone pass silently, pause after the milestone step (scored).
 *               The milestone step differs per story (step 1, 2 or 3), so its position is no cue.
 *
 * After the decision every regime shows the steps it has not shown yet in an unscored "wrap-up", so that each
 * participant has seen every step exactly once before the understanding questions. Only the reviewed step(s)
 * come with a decision.
 */
export function checkpointsFor(regime: Regime, milestoneStep: number): CheckpointSpec[] {
  switch (regime) {
    case "BATCH":
      return [{ id: "end", scored: true, fromStep: 1, toStep: 4 }, ...wrapUp([1, 2, 3, 4])];
    case "CHECKPOINT":
      return [{ id: `after-step-${milestoneStep}`, scored: true, fromStep: milestoneStep, toStep: milestoneStep }, ...wrapUp([milestoneStep])];
  }
}
