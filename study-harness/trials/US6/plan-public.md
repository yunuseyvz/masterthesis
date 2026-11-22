Here is the plan for the coupons, in four steps.

1. **The discount**: `src/lib/pricing/pricing.ts` with `discountFor`, which works out a coupon's discount on an amount.
2. **Types**: `src/lib/pricing/types.ts` with `CouponKind`, `Coupon`, `OrderItem` and `OrderSummary`.
3. **The order summary**: `src/lib/pricing/order.ts` with `summarizeOrder`, which totals an order and applies the coupon.
4. **Tests and docs**: `test/pricing.test.ts` and a section in `README.md`, then `npm test`.
