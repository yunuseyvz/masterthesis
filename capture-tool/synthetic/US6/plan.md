# Plan: coupon discounts on orders

## Context

- Orders are in `src/lib/orders.ts` (`Order`, `orderSubtotal(catalog, order)`); prices come from `src/lib/catalog.ts`.
- Amounts are integer cents; `formatCents` in `src/lib/money.ts` formats them.

## Approach

A `src/lib/pricing/` module: the discount calculation first, then the coupon and summary types, then an order summary that applies a coupon to the subtotal.

## Steps

### 1. Implement discount calculation
- `src/lib/pricing/pricing.ts`:
  - `clampPercent(pct)`: keeps a coupon's percentage in a valid range, so a bad coupon can't produce a nonsense price.
  - `applyDiscount(amountCents, pct)`: price after the discount, rounded to whole cents.

### 2. Add coupon and order summary types
- `src/lib/pricing/types.ts`: `Coupon { code; percent }`, `OrderSummary { subtotalCents; discountCents; totalCents }`.

### 3. Add the order summary calculator
- `src/lib/pricing/order.ts`:
  - `summarizeOrder(catalog, order, coupon?)`: subtotal from `orderSubtotal`, total after the coupon, and the discount as the difference.
  - `formatSummary(summary)`: subtotal, discount and total as aligned lines.

### 4. Add unit tests for pricing
- `test/pricing.test.ts`: a typical discount, no coupon, rounding to cents.
- README: add `pricing/` under "Layout".

Shall I go ahead?
