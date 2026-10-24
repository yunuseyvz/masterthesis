export interface TenantConfig {
  plan: string;
  allowExport: boolean;
  rateLimit: number;
  seats: number;
}

export type Overrides = Partial<TenantConfig>;

export const ORG_DEFAULTS: TenantConfig = {
  plan: "team",
  allowExport: true,
  rateLimit: 100,
  seats: 10,
};

export interface QuotaState {
  used: Map<string, number>;
}

export function createQuotaState(): QuotaState {
  return { used: new Map() };
}
