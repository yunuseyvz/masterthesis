import type { Cents } from "../money.ts";

/** How much credit an outage of at least `minOutage` (a duration such as "4h") earns. */
export interface SlaTier {
  minOutage: string;
  /** Percent of the invoice subtotal, 0-100. */
  creditPercent: number;
}

/** Outages up to `threshold` (a duration such as "30m") are inside the SLA and earn no credit. */
export interface SlaPolicy {
  threshold: string;
  /** Checked in order; the highest satisfied tier applies. */
  tiers: SlaTier[];
}

export interface Outage {
  id: string;
  startedAt: number;
  endedAt: number;
}

export interface InvoiceLine {
  description: string;
  amountCents: Cents;
}

export interface Invoice {
  accountId: string;
  periodStartMs: number;
  periodEndMs: number;
  lines: InvoiceLine[];
  creditCents: Cents;
  totalCents: Cents;
}

/** 5%, 10% and 25% of the subtotal once the miss exceeds 30m, 4h and 12h. */
export const DEFAULT_TIERS: SlaTier[] = [
  { minOutage: "30m", creditPercent: 5 },
  { minOutage: "4h", creditPercent: 10 },
  { minOutage: "12h", creditPercent: 25 },
];

export const DEFAULT_POLICY: SlaPolicy = {
  threshold: "30m",
  tiers: DEFAULT_TIERS,
};
