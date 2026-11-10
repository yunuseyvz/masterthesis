## Step outline: coupons

1. Discount calculation in `src/lib/pricing/pricing.ts`: `discountFor(amountCents, coupon)` with a coupon of
   `kind` `"percentage"` or `"fixed"` and a `value`. A percentage coupon takes that share of the amount, rounded to
   the nearest cent; values from 0 to 100 are valid, above 100 it throws a `ValidationError` ("percentage coupon
   cannot exceed 100"). A fixed coupon is an integer number of cents. The discount never exceeds the amount.
2. Types in `src/lib/pricing/types.ts`: `type CouponKind = "percentage" | "fixed";`, `Coupon` (`code`, `kind`,
   `value`), `OrderItem` and `OrderSummary` (`items`, `subtotalCents`, `discountCents`, `totalCents`, `coupon?`);
   `discountFor` takes a `Coupon`.
3. The order summary calculator in `src/lib/pricing/order.ts`: `summarizeOrder(catalog, order, coupon?)` totals the
   order's items (with `getProduct` and `orderSubtotal` from the existing modules) and applies the coupon once, to the
   subtotal, not to each item.
4. Unit tests in `test/pricing.test.ts`, a README section, then `npm test`.
