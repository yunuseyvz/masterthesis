import { test } from "node:test";
import assert from "node:assert/strict";
import {
  refundForOutage,
  generateBill,
  outageMinutes,
  tierFor,
} from "../src/lib/refunds/bill.ts";
import { DEFAULT_POLICY, type Outage } from "../src/lib/refunds/types.ts";
import { HOUR_MS, MINUTE_MS } from "../src/lib/refunds/time.ts";

const PERIOD_START = 0;
const PERIOD_END = 30 * 24 * HOUR_MS;

function outage(id: string, startMinute: number, minutes: number): Outage {
  return {
    id,
    startedAt: startMinute * MINUTE_MS,
    endedAt: (startMinute + minutes) * MINUTE_MS,
  };
}

function billFor(outages: Outage[], subtotalCents = 10_000) {
  return generateBill({
    accountId: "acct_1",
    periodStartMs: PERIOD_START,
    periodEndMs: PERIOD_END,
    subtotalCents,
    outages,
    policy: DEFAULT_POLICY,
  });
}

test("measures an outage in minutes", () => {
  assert.equal(outageMinutes(outage("o1", 10, 95)), 95);
});

test("picks the highest satisfied tier", () => {
  assert.equal(tierFor(29, DEFAULT_POLICY), undefined);
  assert.equal(tierFor(30, DEFAULT_POLICY)?.refundPercent, 5);
  assert.equal(tierFor(239, DEFAULT_POLICY)?.refundPercent, 5);
  assert.equal(tierFor(240, DEFAULT_POLICY)?.refundPercent, 10);
  assert.equal(tierFor(720, DEFAULT_POLICY)?.refundPercent, 25);
});

test("pays nothing inside the threshold", () => {
  assert.equal(refundForOutage(30, 10_000, DEFAULT_POLICY), 0);
  assert.equal(refundForOutage(0, 10_000, DEFAULT_POLICY), 0);

  const bill = billFor([outage("o1", 60, 20)]);
  assert.equal(bill.refundCents, 0);
  assert.equal(bill.totalCents, 10_000);
});

test("refunds a percentage of the subtotal", () => {
  assert.equal(refundForOutage(45, 10_000, DEFAULT_POLICY), 500);
  assert.equal(refundForOutage(300, 10_000, DEFAULT_POLICY), 1_000);
  assert.equal(refundForOutage(900, 10_000, DEFAULT_POLICY), 2_500);
});

test("rounds refunds down to whole cents", () => {
  assert.equal(refundForOutage(45, 1_999, DEFAULT_POLICY), 99);
});

test("sums the refund over several outages", () => {
  const bill = billFor([outage("o1", 60, 45), outage("o2", 600, 300)]);
  assert.equal(bill.refundCents, 1_500);
  assert.equal(bill.totalCents, 8_500);
});

test("ignores outages outside the billing month", () => {
  const bill = billFor([outage("o1", -120, 60), outage("o2", 43_180, 60)]);
  assert.equal(bill.refundCents, 0);
});

test("itemises the refund line", () => {
  const bill = billFor([outage("o1", 60, 45)]);
  assert.deepEqual(bill.lines, [
    { description: "Subtotal", amountCents: 10_000 },
    { description: "refund policy refund 1", amountCents: -500 },
    { description: "Total", amountCents: 9_500 },
  ]);
});

test("reads the policy's durations", () => {
  const policy = { threshold: "1h", tiers: [{ minOutage: "1h", refundPercent: 20 }] };
  assert.equal(refundForOutage(60, 10_000, policy), 0);
  assert.equal(refundForOutage(61, 10_000, policy), 2_000);
  assert.throws(() => refundForOutage(61, 10_000, { ...policy, threshold: "60" }), /invalid duration part/);
});

test("rejects a reversed billing month", () => {
  assert.throws(
    () =>
      generateBill({
        accountId: "acct_1",
        periodStartMs: PERIOD_END,
        periodEndMs: PERIOD_START,
        subtotalCents: 100,
        outages: [],
        policy: DEFAULT_POLICY,
      }),
    /month ends before it starts/,
  );
});
