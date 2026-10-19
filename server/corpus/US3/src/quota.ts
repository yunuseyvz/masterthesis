import { getEffectiveConfig } from "./config.ts";
import { AppError } from "../errors.ts";
import { ORG_DEFAULTS, type Overrides, type QuotaState } from "./types.ts";

export interface QuotaResult {
  allowed: boolean;
  reason?: string;
}

export function checkQuota(tenantId: string, overrides: Overrides, state: QuotaState): QuotaResult {
  const config = getEffectiveConfig(ORG_DEFAULTS, overrides);
  const used = state.used.get(tenantId) ?? 0;
  if (used >= config.rateLimit) {
    return { allowed: false, reason: "rate limit reached" };
  }
  state.used.set(tenantId, used + 1);
  return { allowed: true };
}

export function withQuota<A extends unknown[], R>(
  tenantId: string,
  overrides: Overrides,
  state: QuotaState,
  fn: (...args: A) => R,
) {
  return (...args: A): R => {
    const result = checkQuota(tenantId, overrides, state);
    if (!result.allowed) {
      throw new AppError(429, result.reason ?? "quota exceeded");
    }
    return fn(...args);
  };
}

export function exportAllowed(overrides: Overrides): boolean {
  return getEffectiveConfig(ORG_DEFAULTS, overrides).allowExport;
}

export function resetQuota(state: QuotaState): void {
  state.used.clear();
}
