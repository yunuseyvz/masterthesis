import { adjustBalance, type Account, type AccountStore } from "../accounts.ts";
import { NotFoundError } from "../errors.ts";
import type { Cents } from "../money.ts";
import { parseDurationMs } from "./duration.ts";
import { HOUR_MS } from "./time.ts";
import { TIERS, type Invoice } from "./types.ts";

export function createInvoice(tierName: string, outage: string): Invoice {
  const tier = TIERS[tierName];
  if (!tier) {
    throw new NotFoundError(`tier ${tierName}`);
  }
  const outageMs = parseDurationMs(outage);
  const billableMs = outageMs > tier.thresholdMs ? outageMs : 0;
  const creditPercent = (billableMs / HOUR_MS) * tier.creditPercentPerHour;
  return { tier: tier.name, outageMs, billableMs, creditPercent };
}

export function formatInvoice(invoice: Invoice): string {
  const hours = (invoice.outageMs / HOUR_MS).toFixed(2);
  return `${invoice.tier}: outage ${hours}h, credit ${invoice.creditPercent.toFixed(1)}%`;
}

export function totalCredit(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.creditPercent, 0);
}

/** The credit in cents for a monthly fee, rounded to the nearest cent. */
export function creditCents(invoice: Invoice, monthlyFeeCents: Cents): Cents {
  return Math.round((monthlyFeeCents * invoice.creditPercent) / 100);
}

/** Credits the customer's account for an outage. */
export function applyInvoiceCredit(store: AccountStore, accountId: string, invoice: Invoice, monthlyFeeCents: Cents): Account {
  return adjustBalance(store, accountId, creditCents(invoice, monthlyFeeCents));
}
