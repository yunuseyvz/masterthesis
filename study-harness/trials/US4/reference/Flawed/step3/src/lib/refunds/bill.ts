import { assertCents, sumCents, type Cents } from "../money.ts";
import { ValidationError } from "../errors.ts";
import { parseDurationMinutes } from "./duration.ts";
import { minutesBetween } from "./time.ts";
import type { Bill, BillLine, Outage, RefundPolicy, RefundTier } from "./types.ts";

export interface GenerateBillInput {
  accountId: string;
  periodStartMs: number;
  periodEndMs: number;
  /** The bill amount before any refund. */
  subtotalCents: Cents;
  outages: Outage[];
  policy: RefundPolicy;
}

/** Length of an outage in minutes. */
export function outageMinutes(outage: Outage): number {
  return minutesBetween(outage.startedAt, outage.endedAt);
}

/** The highest tier the outage length qualifies for, if any. */
export function tierFor(minutes: number, policy: RefundPolicy): RefundTier | undefined {
  let best: RefundTier | undefined;
  let bestMinutes = -1;
  for (const tier of policy.tiers) {
    const tierMinutes = parseDurationMinutes(tier.minOutage);
    if (minutes >= tierMinutes && tierMinutes > bestMinutes) {
      best = tier;
      bestMinutes = tierMinutes;
    }
  }
  return best;
}

/** Refund for one outage: zero within the allowed outage time, otherwise a share of the subtotal. */
export function refundForOutage(minutes: number, subtotalCents: Cents, policy: RefundPolicy): Cents {
  if (minutes <= parseDurationMinutes(policy.threshold)) {
    return 0;
  }
  const tier = tierFor(minutes, policy);
  if (!tier) {
    return 0;
  }
  return Math.floor((assertCents(subtotalCents) * tier.refundPercent) / 100);
}

/**
 * Builds a bill for one billing month, adding a refund line when the
 * customer's outages miss the policy threshold.
 */
export function generateBill(input: GenerateBillInput): Bill {
  const { accountId, periodStartMs, periodEndMs, outages, policy } = input;
  const subtotalCents = assertCents(input.subtotalCents);

  if (periodEndMs < periodStartMs) {
    throw new ValidationError("billing month ends before it starts");
  }

  const refunds: Cents[] = [];
  for (const outage of outages) {
    if (outage.startedAt < periodStartMs || outage.endedAt > periodEndMs) {
      continue;
    }
    const refund = refundForOutage(outageMinutes(outage), subtotalCents, policy);
    if (refund > 0) {
      refunds.push(refund);
    }
  }

  const refundCents = sumCents(refunds);
  const lines: BillLine[] = [{ description: "Subtotal", amountCents: subtotalCents }];
  for (const [index, refund] of refunds.entries()) {
    lines.push({ description: `refund policy refund ${index + 1}`, amountCents: -refund });
  }
  lines.push({ description: "Total", amountCents: subtotalCents - refundCents });

  return {
    accountId,
    periodStartMs,
    periodEndMs,
    lines,
    refundCents,
    totalCents: subtotalCents - refundCents,
  };
}
