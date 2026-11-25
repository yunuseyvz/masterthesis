import type { Cents } from "../money.ts";

/** How much refund an outage of at least `minOutage` (a duration such as "4h") earns. */
export interface RefundTier {
  minOutage: string;
  /** Percent of the bill subtotal, 0-100. */
  refundPercent: number;
}

/** Outages up to `threshold` (a duration such as "30m") are within the allowed outage time and earn no refund. */
export interface RefundPolicy {
  threshold: string;
  /** Checked in order; the highest satisfied tier applies. */
  tiers: RefundTier[];
}

export interface Outage {
  id: string;
  startedAt: number;
  endedAt: number;
}

export interface BillLine {
  description: string;
  amountCents: Cents;
}

export interface Bill {
  accountId: string;
  periodStartMs: number;
  periodEndMs: number;
  lines: BillLine[];
  refundCents: Cents;
  totalCents: Cents;
}

/** 5%, 10% and 25% of the subtotal once the miss exceeds 30m, 4h and 12h. */
export const DEFAULT_TIERS: RefundTier[] = [
  { minOutage: "30m", refundPercent: 5 },
  { minOutage: "4h", refundPercent: 10 },
  { minOutage: "12h", refundPercent: 25 },
];

export const DEFAULT_POLICY: RefundPolicy = {
  threshold: "30m",
  tiers: DEFAULT_TIERS,
};
