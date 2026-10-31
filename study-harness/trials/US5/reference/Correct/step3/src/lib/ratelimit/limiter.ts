import type { Clock } from "../clock.ts";
import {
  RATE_LIMIT_PER_MINUTE,
  WINDOW_MS,
  type ClientHistory,
  type RateLimitDecision,
  type RateLimitOptions,
} from "./types.ts";

export interface RateLimiter {
  /** Records the request when allowed, so callers must call this once per request. */
  check(clientId: string): RateLimitDecision;
  reset(): void;
}

/** Keeps a sliding window of request times per client. */
export function createLimiter(clock: Clock, options: RateLimitOptions = {}): RateLimiter {
  const limit = Math.max(1, options.limit ?? RATE_LIMIT_PER_MINUTE);
  const windowMs = Math.max(1, options.windowMs ?? WINDOW_MS);
  const clients = new Map<string, ClientHistory>();

  return {
    check(clientId) {
      const now = clock.now();
      const history = clients.get(clientId) ?? { clientId, timestamps: [] };
      history.timestamps = history.timestamps.filter((at) => now - at < windowMs);

      if (history.timestamps.length >= limit) {
        clients.set(clientId, history);
        const oldest = history.timestamps[0]!;
        return { allowed: false, retryAfterMs: oldest + windowMs - now };
      }

      history.timestamps.push(now);
      clients.set(clientId, history);
      return { allowed: true };
    },
    reset: () => clients.clear(),
  };
}
