import type { Clock } from "../clock.ts";
import { checkAndRecord } from "./limiter.ts";
import { toResponse } from "./respond.ts";
import { DEFAULT_CONFIG, createBucket, type ClientBucket, type FilterResult, type LimiterConfig } from "./types.ts";

export class RateLimitFilter {
  private readonly buckets = new Map<string, ClientBucket>();
  private readonly config: LimiterConfig;

  constructor(config: LimiterConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  handle(clientId: string, now: number): FilterResult {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = createBucket();
      this.buckets.set(clientId, bucket);
    }
    if (checkAndRecord(bucket, now, this.config)) {
      return { status: 200 };
    }
    const oldest = bucket.timestamps[0] ?? now;
    return { status: 429, retryAfterMs: Math.max(0, oldest + this.config.windowMs - now) };
  }

  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }

  activeClients(): number {
    return this.buckets.size;
  }
}

/** Wraps a route handler: requests over the client's limit get a 429, everything else reaches `next`. */
export function withRateLimit(
  filter: RateLimitFilter,
  clock: Clock,
  clientOf: (req: Request) => string,
  next: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const result = filter.handle(clientOf(req), clock.now());
    return result.status === 200 ? next(req) : toResponse(result);
  };
}
