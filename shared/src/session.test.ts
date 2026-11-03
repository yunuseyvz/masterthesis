import { describe, expect, it } from "vitest";
import { SessionPlan, generateSessionPlan, STORIES, WILLIAMS_6 } from "./index.js";

describe("generateSessionPlan", () => {
  it("is deterministic for a seed", () => {
    const a = generateSessionPlan({ participantId: "P1", studySeed: "91827364" });
    const b = generateSessionPlan({ participantId: "P1", studySeed: "91827364" });
    expect(a).toEqual(b);
    expect(SessionPlan.safeParse(a).success).toBe(true);
  });

  it("gives each participant every regime x variant cell once", () => {
    for (let g = 0; g < 6; g++) {
      const p = generateSessionPlan({ participantId: "P", studySeed: "1", group: g });
      const cells = new Set(p.trials.map((t) => `${t.regime}|${t.variant}`));
      expect(cells.size).toBe(6);
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

  it("rejects groups outside 0..5", () => {
    expect(() => generateSessionPlan({ participantId: "P", studySeed: "1", group: 6 })).toThrow();
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

  it("with rounds, splits each story's NON_MILESTONE pause steps 5:5 over N = 30, without changing shuffles", () => {
    const draws = new Map<string, number[]>();
    for (let n = 0; n < 30; n++) {
      const plan = generateSessionPlan({ participantId: "P", studySeed: String(n), group: n % 6, round: Math.floor(n / 6) });
      const coin = generateSessionPlan({ participantId: "P", studySeed: String(n), group: n % 6 });
      expect(plan.trials.map((t) => t.understandingOptionOrders)).toEqual(coin.trials.map((t) => t.understandingOptionOrders));
      for (const t of plan.trials.filter((t) => t.regime === "NON_MILESTONE")) draws.set(t.story, [...(draws.get(t.story) ?? []), t.pauseDraw]);
    }
    expect(draws.size).toBe(6);
    for (const d of draws.values()) expect([d.length, d.filter((x) => x === 1).length]).toEqual([10, 5]);
  });
});
