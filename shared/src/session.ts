import { makeRng, parseSeed, shuffle } from "./prng.js";
import { UNDERSTANDING_ITEMS, type Regime, type SessionPlan, type StoryId, type TrialPlan, type Variant } from "./schema.js";

export const STORIES: readonly StoryId[] = ["US1", "US2", "US3", "US4", "US5", "US6"];

export const WILLIAMS_6: readonly (readonly number[])[] = (() => {
  const first = [0, 1, 5, 2, 4, 3];
  return Array.from({ length: 6 }, (_, g) => first.map((x) => (x + g) % 6));
})();

// Cells 0-2 are Correct, 3-5 Flawed; cell % 3 picks the regime.
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
  group?: number;
  round?: number;
}

// Story s in group g gets cell (s + g) mod 6, so every story meets every Regime x Variant cell across groups.
export function generateSessionPlan(input: PlanInput): SessionPlan {
  const rng = makeRng(parseSeed(input.studySeed));
  const drawnGroup = Math.floor(rng() * GROUPS); // always drawn so later draws don't depend on override
  const group = input.group ?? drawnGroup;
  if (!Number.isInteger(group) || group < 0 || group >= GROUPS) throw new Error(`group must be 0..${GROUPS - 1}, got ${group}`);
  const { round } = input;
  if (round !== undefined && (!Number.isInteger(round) || round < 0)) throw new Error(`round must be a non-negative integer, got ${round}`);

  const order = WILLIAMS_6[group]!;
  const trials: TrialPlan[] = order.map((storyIdx, i) => {
    const { regime, variant } = cellToCondition((storyIdx + group) % 6);
    const coin = rng() < 0.5 ? 0 : 1; // always drawn so the round does not shift later shuffles
    return {
      position: i + 1,
      story: STORIES[storyIdx]!,
      regime,
      variant,
      probeOptionOrder: shuffle([0, 1, 2, 3], rng),
      understandingOptionOrders: understandingOrders(rng),
      // Alternating by round + group balances the two candidate steps (only US1 has two).
      pauseDraw: round === undefined ? coin : (round + group) % 2,
    };
  });

  // Drawn last so the practice trial never shifts the measured trials' shuffles.
  const practice: TrialPlan = {
    position: 0,
    story: "US0",
    regime: "MILESTONE",
    variant: "Correct",
    probeOptionOrder: shuffle([0, 1, 2, 3], rng),
    understandingOptionOrders: understandingOrders(rng),
    pauseDraw: 0,
  };

  return { participantId: input.participantId, studySeed: input.studySeed, group, round, practice, trials };
}
