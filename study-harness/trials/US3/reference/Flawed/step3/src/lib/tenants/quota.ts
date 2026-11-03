import { QuotaExceededError } from "../errors.ts";
import { limitFor } from "./config.ts";
import { ORGANIZATION_DEFAULTS, type LimitName, type Tenant, type TenantConfig } from "./types.ts";

/** Throws when `used + amount` would take usage past `limit`. */
export function assertWithinQuota(limit: number, used: number, amount = 1, label = "resource"): void {
  if (used + amount > limit) {
    throw new QuotaExceededError(
      `${label} quota exceeded: ${used} of ${limit} used, cannot add ${amount}`,
    );
  }
}

/**
 * Runs `operation` only when the tenant is within its effective limit for `name`.
 * Returns the operation's result; the operation is not called when the quota is used up.
 */
export async function withQuota<T>(
  tenant: Tenant,
  name: LimitName,
  used: number,
  operation: () => T | Promise<T>,
  amount = 1,
  defaults: TenantConfig = ORGANIZATION_DEFAULTS,
): Promise<T> {
  assertWithinQuota(limitFor(tenant, name, defaults), used, 1, name);
  return operation();
}
