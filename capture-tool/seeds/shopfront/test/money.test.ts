import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCents, formatCents, sumCents } from "../src/lib/money.ts";

test("formats cents as dollars", () => {
  assert.equal(formatCents(1999), "$19.99");
  assert.equal(formatCents(5), "$0.05");
  assert.equal(formatCents(-250), "-$2.50");
});

test("sums integer cents", () => {
  assert.equal(sumCents([100, 250, 5]), 355);
});

test("rejects fractional cents", () => {
  assert.throws(() => assertCents(10.5), RangeError);
});
