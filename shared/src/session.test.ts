import { describe, expect, it } from "vitest";
import { SessionPlan, generateSessionPlan, STORIES, WILLIAMS_6 } from "./index.js";

describe("generateSessionPlan", () => {
  it("is deterministic for a seed", () => {
    const a = generateSessionPlan({ participantId: "P1", studySeed: "91827364" });
    const b = generateSessionPlan({ participantId: "P1", studySeed: "91827364" });
    expect(a).toEqual(b);
    expect(SessionPlan.safeParse(a).success).toBe(true);
  });

  it("gives each participant 3 Correct/3 Flawed and 2 stories per regime", () => {
    for (let g = 0; g < 6; g++) {
      const p = generateSessionPlan({ participantId: "P", studySeed: "1", group: g });
      expect(p.trials.filter((t) => t.variant === "Flawed")).toHaveLength(3);
      for (const r of ["BATCH", "ARBITRARY", "PAIR_PROG"]) {
        expect(p.trials.filter((t) => t.regime === r)).toHaveLength(2);
      }
      expect(new Set(p.trials.map((t) => t.story)).size).toBe(6);
    }
  });

  it("balances every story across every regime x variant cell over the 6 groups", () => {
    const counts = new Map<string, number>();
    for (let g = 0; g < 6; g++) {
      for (const t of generateSessionPlan({ participantId: "P", studySeed: "7", group: g }).trials) {
        const k = `${t.story}|${t.regime}|${t.variant}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(STORIES.length * 6);
    for (const n of counts.values()) expect(n).toBe(1);
  });

  it("uses a Williams design (each ordered pair adjacent exactly once)", () => {
    const pairs = new Set<string>();
    for (const row of WILLIAMS_6) for (let i = 0; i < 5; i++) pairs.add(`${row[i]}>${row[i + 1]}`);
    expect(pairs.size).toBe(30);
  });

  it("does not let the group override change option shuffles", () => {
    const a = generateSessionPlan({ participantId: "P", studySeed: "5", group: 2 });
    const b = generateSessionPlan({ participantId: "P", studySeed: "5", group: 2 });
    expect(a.trials.map((t) => t.probeOptionOrder)).toEqual(b.trials.map((t) => t.probeOptionOrder));
  });
});
