export interface BillingTier {
  name: string;
  thresholdMs: number;
  creditPercentPerHour: number;
}

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
export const SECOND_MS = 1_000;

export const TIERS: Record<string, BillingTier> = {
  standard: { name: "standard", thresholdMs: HOUR_MS, creditPercentPerHour: 5 },
  premium: { name: "premium", thresholdMs: 30 * MINUTE_MS, creditPercentPerHour: 10 },
};

export interface Invoice {
  tier: string;
  outageMs: number;
  billableMs: number;
  creditPercent: number;
}
