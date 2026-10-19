import { ValidationError } from "../errors.ts";
import { HOUR_MS, MINUTE_MS, SECOND_MS } from "./time.ts";

const UNIT_MS: Record<string, number> = { h: HOUR_MS, m: MINUTE_MS, s: SECOND_MS };

/** Parses durations such as "2h", "45m" or "1h30m" into milliseconds. */
export function parseDurationMs(input: string): number {
  const match = input.trim().match(/(\d+)([hms])$/);
  if (!match) {
    throw new ValidationError(`Invalid duration: ${input}`);
  }
  return Number(match[1]) * UNIT_MS[match[2]!]!;
}
