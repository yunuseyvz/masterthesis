import { makeRng, parseSeed, shuffle } from "./prng.js";
import type { Regime, SessionPlan, StoryId, TrialPlan, Variant } from "./schema.js";

export const STORIES: readonly StoryId[] = ["US1", "US2", "US3", "US4", "US5", "US6"];

/**
 * Williams design for n = 6 (balanced for first-order carryover).
 * Row g gives the story presentation order for group g.
 */
export const WILLIAMS_6: readonly (readonly number[])[] = (() => {
  const first = [0, 1, 5, 2, 4, 3];
  return Array.from({ length: 6 }, (_, g) => first.map((x) => (x + g) % 6));
})();

/**
 * Cell index 0..5 -> (regime, variant). Cells 0-2 are Correct x regime,
 * cells 3-5 are Flawed x regime, so each participant gets 3 Correct + 3 Flawed
 * and 2 stories per regime.
 */
const REGIMES: readonly Regime[] = ["BATCH", "ARBITRARY", "PAIR_PROG"];
function cellToCondition(cell: number): { regime: Regime; variant: Variant } {
  return { regime: REGIMES[cell % 3]!, variant: cell < 3 ? "Correct" : "Flawed" };
}

export interface PlanInput {
  participantId: string;
  studySeed: string;
  /** Explicit group 0..5. Preferred: derive from participant number so groups stay balanced. */
  group?: number;
}

/**
 * Story s in group g gets cell (s + g) mod 6, so across the 6 groups every story
 * appears exactly once in every Regime x Variant cell. Balanced at N = multiple of 6.
 */
export function generateSessionPlan(input: PlanInput): SessionPlan {
  const rng = makeRng(parseSeed(input.studySeed));
  const drawnGroup = Math.floor(rng() * 6); // always drawn so later draws don't depend on override
  const group = input.group ?? drawnGroup;
  if (!Number.isInteger(group) || group < 0 || group > 5) throw new Error(`group must be 0..5, got ${group}`);

  const order = WILLIAMS_6[group]!;
  const trials: TrialPlan[] = order.map((storyIdx, i) => {
    const { regime, variant } = cellToCondition((storyIdx + group) % 6);
    return {
      position: i + 1,
      story: STORIES[storyIdx]!,
      regime,
      variant,
      probeOptionOrder: shuffle([0, 1, 2, 3], rng),
      understandingOptionOrder: shuffle([0, 1, 2, 3], rng),
    };
  });

  // Drawn last so adding/changing the practice trial never shifts the measured trials' shuffles.
  // ARBITRARY shows both prompt types (unscored "Continue" and the scored two-stage checkpoint).
  const practice: TrialPlan = {
    position: 0,
    story: "US0",
    regime: "ARBITRARY",
    variant: "Correct",
    probeOptionOrder: shuffle([0, 1, 2, 3], rng),
    understandingOptionOrder: shuffle([0, 1, 2, 3], rng),
  };

  return { participantId: input.participantId, studySeed: input.studySeed, group, practice, trials };
}
