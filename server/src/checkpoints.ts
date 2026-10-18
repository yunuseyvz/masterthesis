import type { Regime } from "@beacon/shared";

export interface CheckpointSpec {
  id: string;
  /** Exactly one checkpoint per trial is scored (two-stage flow + probe); it is always the last. */
  scored: boolean;
  fromStep: number;
  toStep: number;
}

/**
 * Each checkpoint shows the diff since the previous pause (or since the start).
 *  BATCH:      one pause on the finished work (steps 1-4).
 *  ARBITRARY:  pause after scaffolding (step 1, unscored), then after wiring (steps 2-3, scored).
 *  PAIR_PROG:  skip step 1 silently, pause at the milestone (step 2, scored).
 */
export function checkpointsFor(regime: Regime): CheckpointSpec[] {
  switch (regime) {
    case "BATCH":
      return [{ id: "end", scored: true, fromStep: 1, toStep: 4 }];
    case "ARBITRARY":
      return [
        { id: "after-step-1", scored: false, fromStep: 1, toStep: 1 },
        { id: "after-step-3", scored: true, fromStep: 2, toStep: 3 },
      ];
    case "PAIR_PROG":
      return [{ id: "after-step-2", scored: true, fromStep: 2, toStep: 2 }];
  }
}
