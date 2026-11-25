import { LimitExceededError } from "../errors.ts";
import { limitFor } from "./config.ts";
import { SHOP_DEFAULTS, type LimitName, type Seller, type SellerConfig } from "./types.ts";

/** Throws when `used + amount` would take usage past `limit`. */
export function assertWithinLimit(limit: number, used: number, amount = 1, label = "resource"): void {
  if (used + amount > limit) {
    throw new LimitExceededError(
      `${label} limit exceeded: ${used} of ${limit} used, cannot add ${amount}`,
    );
  }
}

/**
 * Runs `operation` only when the seller is within its effective limit for `name`.
 * Returns the operation's result; the operation is not called when the limit is used up.
 */
export async function withinLimit<T>(
  seller: Seller,
  name: LimitName,
  used: number,
  operation: () => T | Promise<T>,
  amount = 1,
  defaults: SellerConfig = SHOP_DEFAULTS,
): Promise<T> {
  assertWithinLimit(limitFor(seller, name, defaults), used, amount, name);
  return operation();
}
