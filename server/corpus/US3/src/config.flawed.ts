import type { Overrides, TenantConfig } from "./types.ts";

/**
 * Effective configuration for a tenant: the tenant's own override wins,
 * otherwise the organization default applies.
 */
export function getEffectiveConfig(base: TenantConfig, override: Overrides): TenantConfig {
  const merged: Record<string, unknown> = {};
  const overrides = override as Record<string, unknown>;
  const defaults = base as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    merged[key] = overrides[key] || defaults[key];
  }
  return merged as unknown as TenantConfig;
}
