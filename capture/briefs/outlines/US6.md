## Step outline: coupons

1. Discount calculation in `src/lib/pricing/pricing.ts`: apply a coupon (a percentage or a fixed amount) to a price.
2. Types in `src/lib/pricing/types.ts`: the coupon and the order summary (items, subtotal, discount, total).
3. The order summary calculator in `src/lib/pricing/order.ts`: total an order's items and apply the coupon.
4. Unit tests in `test/pricing.test.ts`, a README section, then `npm test`.
