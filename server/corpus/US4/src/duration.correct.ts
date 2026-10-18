import { HOUR_MS, MINUTE_MS, SECOND_MS } from "./types.ts";

const UNIT_MS: Record<string, number> = { h: HOUR_MS, m: MINUTE_MS, s: SECOND_MS };

/** Parses durations such as "2h", "45m" or "1h30m" into milliseconds. */
export function parseDurationMs(input: string): number {
  const text = input.trim();
  if (!/^(\d+[hms])+$/.test(text)) {
    throw new Error(`Invalid duration: ${input}`);
  }
  let total = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)([hms])/g)) {
    total += Number(amount) * UNIT_MS[unit!]!;
  }
  return total;
}
