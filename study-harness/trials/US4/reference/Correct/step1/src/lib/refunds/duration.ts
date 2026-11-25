import { ValidationError } from "../errors.ts";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "./time.ts";

const UNIT_MS: Record<string, number> = {
  d: DAY_MS,
  h: HOUR_MS,
  m: MINUTE_MS,
  s: SECOND_MS,
};

const PART = /^(\d+)([dhms])$/;

/**
 * Parses an outage duration such as "1h 30m" or "45m" into minutes.
 * Every part needs an explicit unit; a bare number is rejected.
 */
export function parseDurationMinutes(input: string): number {
  const text = input.trim().toLowerCase();
  if (!text) {
    throw new ValidationError("duration is empty");
  }

  const seen = new Set<string>();
  let totalMs = 0;

  for (const part of text.split(/\s+/)) {
    const match = PART.exec(part);
    if (!match) {
      throw new ValidationError(`invalid duration part: ${part}`);
    }

    const value = Number(match[1]);
    const unit = match[2];
    if (value === 0) {
      throw new ValidationError(`duration part must be positive: ${part}`);
    }
    if (seen.has(unit)) {
      throw new ValidationError(`duplicate unit in duration: ${unit}`);
    }

    seen.add(unit);
    totalMs += value * UNIT_MS[unit];
  }

  return totalMs / MINUTE_MS;
}
