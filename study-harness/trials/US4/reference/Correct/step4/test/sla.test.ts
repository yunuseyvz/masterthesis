import { test } from "node:test";
import assert from "node:assert/strict";
import {
  creditForOutage,
  generateInvoice,
  outageMinutes,
  tierFor,
} from "../src/lib/sla/invoice.ts";
import { DEFAULT_POLICY, type Outage } from "../src/lib/sla/types.ts";
import { HOUR_MS, MINUTE_MS } from "../src/lib/sla/time.ts";

const PERIOD_START = 0;
const PERIOD_END = 30 * 24 * HOUR_MS;

function outage(id: string, startMinute: number, minutes: number): Outage {
  return {
    id,
    startedAt: startMinute * MINUTE_MS,
    endedAt: (startMinute + minutes) * MINUTE_MS,
  };
}

function invoiceFor(outages: Outage[], subtotalCents = 10_000) {
  return generateInvoice({
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
  assert.equal(tierFor(30, DEFAULT_POLICY)?.creditPercent, 5);
  assert.equal(tierFor(239, DEFAULT_POLICY)?.creditPercent, 5);
  assert.equal(tierFor(240, DEFAULT_POLICY)?.creditPercent, 10);
  assert.equal(tierFor(720, DEFAULT_POLICY)?.creditPercent, 25);
});

test("pays nothing inside the threshold", () => {
  assert.equal(creditForOutage(30, 10_000, DEFAULT_POLICY), 0);
  assert.equal(creditForOutage(0, 10_000, DEFAULT_POLICY), 0);

  const invoice = invoiceFor([outage("o1", 60, 20)]);
  assert.equal(invoice.creditCents, 0);
  assert.equal(invoice.totalCents, 10_000);
});

test("credits a percentage of the subtotal", () => {
  assert.equal(creditForOutage(45, 10_000, DEFAULT_POLICY), 500);
  assert.equal(creditForOutage(300, 10_000, DEFAULT_POLICY), 1_000);
  assert.equal(creditForOutage(900, 10_000, DEFAULT_POLICY), 2_500);
});

test("rounds credits down to whole cents", () => {
  assert.equal(creditForOutage(45, 1_999, DEFAULT_POLICY), 99);
});

test("sums the credit over several outages", () => {
  const invoice = invoiceFor([outage("o1", 60, 45), outage("o2", 600, 300)]);
  assert.equal(invoice.creditCents, 1_500);
  assert.equal(invoice.totalCents, 8_500);
});

test("ignores outages outside the billing period", () => {
  const invoice = invoiceFor([outage("o1", -120, 60), outage("o2", 43_180, 60)]);
  assert.equal(invoice.creditCents, 0);
});

test("itemises the credit line", () => {
  const invoice = invoiceFor([outage("o1", 60, 45)]);
  assert.deepEqual(invoice.lines, [
    { description: "Subtotal", amountCents: 10_000 },
    { description: "SLA credit 1", amountCents: -500 },
    { description: "Total", amountCents: 9_500 },
  ]);
});

test("reads the policy's durations", () => {
  const policy = { threshold: "1h", tiers: [{ minOutage: "1h", creditPercent: 20 }] };
  assert.equal(creditForOutage(60, 10_000, policy), 0);
  assert.equal(creditForOutage(61, 10_000, policy), 2_000);
  assert.throws(() => creditForOutage(61, 10_000, { ...policy, threshold: "60" }), /invalid duration part/);
});

test("rejects a reversed billing period", () => {
  assert.throws(
    () =>
      generateInvoice({
        accountId: "acct_1",
        periodStartMs: PERIOD_END,
        periodEndMs: PERIOD_START,
        subtotalCents: 100,
        outages: [],
        policy: DEFAULT_POLICY,
      }),
    /period ends before it starts/,
  );
});
