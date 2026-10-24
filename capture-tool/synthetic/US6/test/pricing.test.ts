import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount } from "../src/lib/pricing/pricing.ts";

test("applies a percentage discount", () => {
  assert.equal(applyDiscount(20_000, 10), 18_000);
});

test("caps discounts at 100%", () => {
  assert.equal(applyDiscount(20_000, 150), 0);
});

test("a 0% discount leaves the price unchanged", () => {
  assert.equal(applyDiscount(20_000, 0), 20_000);
});
