import { HOUR_MS, MINUTE_MS } from "./time.ts";

export interface BillingTier {
  name: string;
  thresholdMs: number;
  creditPercentPerHour: number;
}

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
