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
 * Cell index 0..5 -> (regime, variant). Even cells are BATCH (control), odd cells CHECKPOINT (intervention),
 * so each participant gets 3 stories per regime. Three stories are Flawed per participant. Because 3 does not
 * split evenly over 2 regimes, the Flawed set is one of two complementary sets (`flip` 0 or 1): with flip 0 the
 * cells 0, 2, 3 are Flawed, with flip 1 the cells 1, 4, 5. Over both flips every cell is Flawed exactly once, so
 * the 12 groups balance every story across every regime x variant cell (3 times each).
 */
const REGIMES: readonly Regime[] = ["BATCH", "CHECKPOINT"];
const FLAWED_CELLS: readonly (readonly number[])[] = [[0, 2, 3], [1, 4, 5]];
export const GROUPS = 12;
function cellToCondition(cell: number, flip: number): { regime: Regime; variant: Variant } {
  return { regime: REGIMES[cell % 2]!, variant: FLAWED_CELLS[flip]!.includes(cell) ? "Flawed" : "Correct" };
}

const understandingOrders = (rng: () => number) =>
  Array.from({ length: UNDERSTANDING_ITEMS }, () => shuffle([0, 1, 2, 3], rng));

export interface PlanInput {
  participantId: string;
  studySeed: string;
  /** Explicit group 0..11. Preferred: derive from participant number so groups stay balanced. */
  group?: number;
}

/**
 * Group g = 6 * flip + w. Story s in group g gets cell (s + w) mod 6 and Flawed set `flip`, so across the 12 groups
 * every story appears 3 times in every Regime x Variant cell. Balanced at N = multiple of 12 (36 = 3 x 12).
 */
export function generateSessionPlan(input: PlanInput): SessionPlan {
  const rng = makeRng(parseSeed(input.studySeed));
  const drawnGroup = Math.floor(rng() * GROUPS); // always drawn so later draws don't depend on override
  const group = input.group ?? drawnGroup;
  if (!Number.isInteger(group) || group < 0 || group >= GROUPS) throw new Error(`group must be 0..${GROUPS - 1}, got ${group}`);

  const order = WILLIAMS_6[group % 6]!;
  const flip = Math.floor(group / 6);
  const trials: TrialPlan[] = order.map((storyIdx, i) => {
    const { regime, variant } = cellToCondition((storyIdx + group) % 6, flip);
    return {
      position: i + 1,
      story: STORIES[storyIdx]!,
      regime,
      variant,
      probeOptionOrder: shuffle([0, 1, 2, 3], rng),
      understandingOptionOrders: understandingOrders(rng),
    };
  });

  // Drawn last so adding/changing the practice trial never shifts the measured trials' shuffles.
  // The practice trial only teaches the flow. It uses the intervention regime so that the participant also sees
  // the wrap-up screen once; the defect never needs to be found.
  const practice: TrialPlan = {
    position: 0,
    story: "US0",
    regime: "CHECKPOINT",
    variant: "Correct",
    probeOptionOrder: shuffle([0, 1, 2, 3], rng),
    understandingOptionOrders: understandingOrders(rng),
  };

  return { participantId: input.participantId, studySeed: input.studySeed, group, practice, trials };
}
