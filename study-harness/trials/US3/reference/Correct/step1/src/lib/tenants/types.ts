/** Capabilities a tenant may have switched on or off. */
export interface TenantFeatureFlags {
  checkout: boolean;
  refunds: boolean;
  analytics: boolean;
}

/** Numeric ceilings that apply to a tenant's usage. */
export interface TenantLimits {
  maxUsers: number;
  maxProducts: number;
  monthlyOrders: number;
}

/** A tenant's complete, effective configuration. */
export interface TenantConfig {
  features: TenantFeatureFlags;
  limits: TenantLimits;
}

/** The fields a tenant may customize; anything omitted falls back to the organization defaults. */
export interface TenantOverrides {
  features?: Partial<TenantFeatureFlags>;
  limits?: Partial<TenantLimits>;
}

export interface Tenant {
  id: string;
  name: string;
  overrides: TenantOverrides;
}

export type FeatureName = keyof TenantFeatureFlags;
export type LimitName = keyof TenantLimits;

/** The baseline every tenant inherits until it overrides a field. */
export const ORGANIZATION_DEFAULTS: TenantConfig = {
  features: {
    checkout: true,
    refunds: true,
    analytics: false,
  },
  limits: {
    maxUsers: 5,
    maxProducts: 100,
    monthlyOrders: 1000,
  },
};
