/** Length of the sliding window, in milliseconds. */
export const WINDOW_MS = 60_000;

/** Requests one client may make per window by default. */
export const RATE_LIMIT_PER_MINUTE = 60;

/** Request timestamps recorded for one client within the current window. */
export interface ClientHistory {
  clientId: string;
  timestamps: number[];
}

/** Optional per-limiter overrides of the defaults above. */
export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

/** Outcome of checking one request against a client's history. */
export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };
