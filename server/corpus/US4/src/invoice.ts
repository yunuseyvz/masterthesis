import { parseDurationMs } from "./duration.ts";
import { HOUR_MS, TIERS, type Invoice } from "./types.ts";

export function createInvoice(tierName: string, outage: string): Invoice {
  const tier = TIERS[tierName];
  if (!tier) {
    throw new Error(`Unknown tier: ${tierName}`);
  }
  const outageMs = parseDurationMs(outage);
  const billableMs = Math.max(0, outageMs - tier.thresholdMs);
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
