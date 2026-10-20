import { makeRng, parseSeed, shuffle } from "./prng.js";
import { UNDERSTANDING_ITEMS, type Regime, type SessionPlan, type StoryId, type TrialPlan, type Variant } from "./schema.js";

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
 * Cell index 0..5 -> (regime, variant): cells 0-2 are Correct, 3-5 Flawed, and cell % 3 picks the regime.
 * Each participant meets every cell once, so they get two stories per regime, one Correct and one Flawed.
 */
const REGIMES: readonly Regime[] = ["BATCH", "MILESTONE", "NON_MILESTONE"];
export const GROUPS = 6;
function cellToCondition(cell: number): { regime: Regime; variant: Variant } {
  return { regime: REGIMES[cell % 3]!, variant: cell < 3 ? "Correct" : "Flawed" };
}

const understandingOrders = (rng: () => number) =>
  Array.from({ length: UNDERSTANDING_ITEMS }, () => shuffle([0, 1, 2, 3], rng));

export interface PlanInput {
  participantId: string;
  studySeed: string;
  /** Explicit group 0..5. Preferred: derive from participant number so groups stay balanced. */
  group?: number;
}

/**
 * Story s in group g gets cell (s + g) mod 6 and the presentation order of Williams row g, so across the 6 groups
 * every story appears once in every Regime x Variant cell. Balanced at N = multiple of 6 (30 = 5 x 6).
 */
export function generateSessionPlan(input: PlanInput): SessionPlan {
  const rng = makeRng(parseSeed(input.studySeed));
  const drawnGroup = Math.floor(rng() * GROUPS); // always drawn so later draws don't depend on override
  const group = input.group ?? drawnGroup;
  if (!Number.isInteger(group) || group < 0 || group >= GROUPS) throw new Error(`group must be 0..${GROUPS - 1}, got ${group}`);

  const order = WILLIAMS_6[group]!;
  const trials: TrialPlan[] = order.map((storyIdx, i) => {
    const { regime, variant } = cellToCondition((storyIdx + group) % 6);
    return {
      position: i + 1,
      story: STORIES[storyIdx]!,
      regime,
      variant,
      probeOptionOrder: shuffle([0, 1, 2, 3], rng),
      understandingOptionOrders: understandingOrders(rng),
      pauseDraw: rng() < 0.5 ? 0 : 1,
    };
  });

  // Drawn last so adding/changing the practice trial never shifts the measured trials' shuffles.
  // The practice trial only teaches the flow. It pauses at the milestone so that the participant also sees the
  // wrap-up screen once; the defect never needs to be found.
  const practice: TrialPlan = {
    position: 0,
    story: "US0",
    regime: "MILESTONE",
    variant: "Correct",
    probeOptionOrder: shuffle([0, 1, 2, 3], rng),
    understandingOptionOrders: understandingOrders(rng),
    pauseDraw: 0,
  };

  return { participantId: input.participantId, studySeed: input.studySeed, group, practice, trials };
}
