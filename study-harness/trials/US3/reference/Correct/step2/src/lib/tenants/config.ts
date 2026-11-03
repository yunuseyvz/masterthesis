import {
  ORGANIZATION_DEFAULTS,
  type FeatureName,
  type LimitName,
  type Tenant,
  type TenantConfig,
} from "./types.ts";

/**
 * A tenant's effective configuration: the organization defaults with the tenant's own overrides applied. A limit
 * override can only lower a limit; a value above the default is capped at the default.
 */
export function resolveTenantConfig(
  tenant: Tenant,
  defaults: TenantConfig = ORGANIZATION_DEFAULTS,
): TenantConfig {
  const limits = { ...defaults.limits };
  for (const name of Object.keys(limits) as LimitName[]) {
    const override = tenant.overrides.limits?.[name];
    if (override !== undefined) limits[name] = Math.min(override, defaults.limits[name]);
  }
  return {
    features: { ...defaults.features, ...tenant.overrides.features },
    limits,
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
