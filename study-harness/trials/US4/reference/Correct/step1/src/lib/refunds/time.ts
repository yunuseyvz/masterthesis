import { ValidationError } from "../errors.ts";

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Whole or fractional minutes between two epoch-millisecond timestamps. */
export function minutesBetween(fromMs: number, toMs: number): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new ValidationError("timestamps must be finite numbers");
  }
  if (toMs < fromMs) {
    throw new ValidationError(`end ${toMs} is before start ${fromMs}`);
  }
  return (toMs - fromMs) / MINUTE_MS;
}
