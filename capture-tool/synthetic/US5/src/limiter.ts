import type { ClientBucket, LimiterConfig } from "./types.ts";

/**
 * Sliding-window check. Returns true if the request is allowed.
 * Only allowed requests count against the client's window.
 */
export function checkAndRecord(bucket: ClientBucket, now: number, cfg: LimiterConfig): boolean {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < cfg.windowMs);
  if (bucket.timestamps.length >= cfg.limit) {
    return false;
  }
  bucket.timestamps.push(now);
  return true;
}
