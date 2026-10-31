import {
  ORGANIZATION_DEFAULTS,
  type FeatureName,
  type LimitName,
  type Tenant,
  type TenantConfig,
} from "./types.ts";

/** A tenant's effective configuration: the organization defaults with the tenant's own overrides applied. */
export function resolveTenantConfig(
  tenant: Tenant,
  defaults: TenantConfig = ORGANIZATION_DEFAULTS,
): TenantConfig {
  return {
    features: { ...defaults.features, ...tenant.overrides.features },
    limits: { ...defaults.limits, ...tenant.overrides.limits },
  };
}

/** Whether a tenant has a feature switched on by default or through its own override. */
export function isFeatureEnabled(
  tenant: Tenant,
  flag: FeatureName,
  defaults: TenantConfig = ORGANIZATION_DEFAULTS,
): boolean {
  return resolveTenantConfig(tenant, defaults).features[flag];
}

/** A tenant's effective value for one limit, after overrides. */
export function limitFor(
  tenant: Tenant,
  name: LimitName,
  defaults: TenantConfig = ORGANIZATION_DEFAULTS,
): number {
  return resolveTenantConfig(tenant, defaults).limits[name];
}
