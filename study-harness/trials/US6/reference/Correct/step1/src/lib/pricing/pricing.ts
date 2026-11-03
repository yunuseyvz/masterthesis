import { ValidationError } from "../errors.ts";
import { assertCents, type Cents } from "../money.ts";

/**
 * The discount a coupon gives on an amount, in cents. A percentage coupon is
 * rounded to the nearest cent; a fixed coupon is already an amount in cents.
 * The discount is capped at the amount, so it can never make a total negative.
 */
export function discountFor(
  amountCents: Cents,
  coupon: { kind: "percentage" | "fixed"; value: number },
): Cents {
  assertCents(amountCents);
  if (!Number.isFinite(coupon.value) || coupon.value < 0) {
    throw new ValidationError("coupon value must be a non-negative number");
  }

  let discount: number;
  if (coupon.kind === "percentage") {
    if (coupon.value > 100) {
      throw new ValidationError("percentage coupon cannot exceed 100");
    }
    discount = Math.round((amountCents * coupon.value) / 100);
  } else if (coupon.kind === "fixed") {
    if (!Number.isInteger(coupon.value)) {
      throw new ValidationError("fixed coupon must be an integer number of cents");
    }
    discount = coupon.value;
  } else {
    throw new ValidationError(`unknown coupon kind: ${coupon.kind}`);
  }

  return Math.min(Math.max(discount, 0), amountCents);
}
