import type { Cents } from "../money.ts";

/** How much credit an outage of at least `minOutageMinutes` earns. */
export interface SlaTier {
  minOutageMinutes: number;
  /** Percent of the invoice subtotal, 0-100. */
  creditPercent: number;
}

/** Outages this short are inside the SLA and earn no credit. */
export interface SlaPolicy {
  thresholdMinutes: number;
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
  { minOutageMinutes: 30, creditPercent: 5 },
  { minOutageMinutes: 240, creditPercent: 10 },
  { minOutageMinutes: 720, creditPercent: 25 },
];

export const DEFAULT_POLICY: SlaPolicy = {
  thresholdMinutes: 30,
  tiers: DEFAULT_TIERS,
};
