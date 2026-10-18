export interface LimiterConfig {
  limit: number;
  windowMs: number;
}

export interface ClientBucket {
  timestamps: number[];
}

export interface FilterResult {
  status: 200 | 429;
  retryAfterMs?: number;
}

export const DEFAULT_CONFIG: LimiterConfig = { limit: 2, windowMs: 60_000 };

export function createBucket(): ClientBucket {
  return { timestamps: [] };
}
