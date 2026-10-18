/** Seeded PRNG (mulberry32). All study randomness must go through this. */

export type Rng = () => number;

/** Parse a decimal seed string into a uint32 (e.g. STUDY_SEED="91827364"). */
export function parseSeed(seed: string): number {
  if (!/^\d+$/.test(seed)) throw new Error(`STUDY_SEED must be a non-negative integer, got "${seed}"`);
  return Number(BigInt(seed) % 4294967296n) >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
