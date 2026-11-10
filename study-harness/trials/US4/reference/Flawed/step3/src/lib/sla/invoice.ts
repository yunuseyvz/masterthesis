import { assertCents, sumCents, type Cents } from "../money.ts";
import { ValidationError } from "../errors.ts";
import { parseDurationMinutes } from "./duration.ts";
import { minutesBetween } from "./time.ts";
import type { Invoice, InvoiceLine, Outage, SlaPolicy, SlaTier } from "./types.ts";

export interface GenerateInvoiceInput {
  accountId: string;
  periodStartMs: number;
  periodEndMs: number;
  /** The invoice amount before any SLA credit. */
  subtotalCents: Cents;
  outages: Outage[];
  policy: SlaPolicy;
}

/** Length of an outage in minutes. */
export function outageMinutes(outage: Outage): number {
  return minutesBetween(outage.startedAt, outage.endedAt);
}

/** The highest tier the outage length qualifies for, if any. */
export function tierFor(minutes: number, policy: SlaPolicy): SlaTier | undefined {
  let best: SlaTier | undefined;
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

/** Credit for one outage: zero inside the SLA, otherwise a share of the subtotal. */
export function creditForOutage(minutes: number, subtotalCents: Cents, policy: SlaPolicy): Cents {
  if (minutes <= parseDurationMinutes(policy.threshold)) {
    return 0;
  }
  const tier = tierFor(minutes, policy);
  if (!tier) {
    return 0;
  }
  return Math.floor((assertCents(subtotalCents) * tier.creditPercent) / 100);
}

/**
 * Builds an invoice for one billing period, adding an SLA credit line when the
 * customer's outages miss the policy threshold.
 */
export function generateInvoice(input: GenerateInvoiceInput): Invoice {
  const { accountId, periodStartMs, periodEndMs, outages, policy } = input;
  const subtotalCents = assertCents(input.subtotalCents);

  if (periodEndMs < periodStartMs) {
    throw new ValidationError("billing period ends before it starts");
  }

  const credits: Cents[] = [];
  for (const outage of outages) {
    if (outage.startedAt < periodStartMs || outage.endedAt > periodEndMs) {
      continue;
    }
    const credit = creditForOutage(outageMinutes(outage), subtotalCents, policy);
    if (credit > 0) {
      credits.push(credit);
    }
  }

  const creditCents = sumCents(credits);
  const lines: InvoiceLine[] = [{ description: "Subtotal", amountCents: subtotalCents }];
  for (const [index, credit] of credits.entries()) {
    lines.push({ description: `SLA credit ${index + 1}`, amountCents: -credit });
  }
  lines.push({ description: "Total", amountCents: subtotalCents - creditCents });

  return {
    accountId,
    periodStartMs,
    periodEndMs,
    lines,
    creditCents,
    totalCents: subtotalCents - creditCents,
  };
}
