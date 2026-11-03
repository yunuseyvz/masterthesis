import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../src/lib/catalog.ts";
import { createOrder } from "../src/lib/orders.ts";
import { summarizeOrder } from "../src/lib/pricing/order.ts";
import { discountFor } from "../src/lib/pricing/pricing.ts";

const catalog = createCatalog([
  { sku: "mug", name: "Mug", priceCents: 1200 },
  { sku: "pen", name: "Pen", priceCents: 300 },
]);

const order = createOrder("o1", "acc_1", [
  { sku: "mug", quantity: 2 },
  { sku: "pen", quantity: 3 },
]);

test("summarises an order without a coupon", () => {
  const summary = summarizeOrder(catalog, order);
  assert.deepEqual(summary.items, [
    { sku: "mug", name: "Mug", quantity: 2, unitPriceCents: 1200, lineTotalCents: 2400 },
    { sku: "pen", name: "Pen", quantity: 3, unitPriceCents: 300, lineTotalCents: 900 },
  ]);
  assert.equal(summary.subtotalCents, 3300);
  assert.equal(summary.discountCents, 0);
  assert.equal(summary.totalCents, 3300);
  assert.equal(summary.coupon, undefined);
});

test("applies a percentage coupon", () => {
  const coupon = { code: "TEN", kind: "percentage" as const, value: 10 };
  const summary = summarizeOrder(catalog, order, coupon);
  assert.equal(summary.subtotalCents, 3300);
  assert.equal(summary.discountCents, 330);
  assert.equal(summary.totalCents, 2970);
  assert.deepEqual(summary.coupon, coupon);
});

test("applies a fixed coupon", () => {
  const summary = summarizeOrder(catalog, order, { code: "FIVE", kind: "fixed", value: 500 });
  assert.equal(summary.discountCents, 500);
  assert.equal(summary.totalCents, 2800);
});

test("never discounts more than the subtotal", () => {
  const summary = summarizeOrder(catalog, order, { code: "BIG", kind: "fixed", value: 5000 });
  assert.equal(summary.discountCents, 3300);
  assert.equal(summary.totalCents, 0);
});

test("rounds a percentage discount to whole cents", () => {
  assert.equal(discountFor(3333, { code: "FIVE", kind: "percentage", value: 5 }), 167);
  assert.equal(discountFor(3333, { code: "TEN", kind: "percentage", value: 10 }), 333);
});

test("totals an empty order", () => {
  const summary = summarizeOrder(catalog, createOrder("o2", "acc_1", []), {
    code: "FIVE",
    kind: "fixed",
    value: 500,
  });
  assert.deepEqual(summary, {
    items: [],
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    coupon: { code: "FIVE", kind: "fixed", value: 500 },
  });
});

test("rejects invalid coupons", () => {
  assert.throws(
    () => discountFor(1000, { code: "BAD", kind: "percentage", value: 101 }),
    /cannot exceed 100/,
  );
  assert.throws(() => discountFor(1000, { code: "BAD", kind: "fixed", value: -1 }), /non-negative/);
  assert.throws(() => discountFor(1000, { code: "BAD", kind: "fixed", value: 10.5 }), /integer/);
  assert.throws(
    () => discountFor(1000, { code: "BAD", kind: "bogus" as "fixed", value: 10 }),
    /unknown coupon kind/,
  );
});
