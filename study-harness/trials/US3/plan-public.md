Here is the plan for the tenant configuration, in four steps.

1. **Types and defaults**: `src/lib/tenants/types.ts` with `TenantFeatureFlags`, `TenantLimits`, `TenantConfig`, `TenantOverrides`, `Tenant` and `ORGANIZATION_DEFAULTS`.
2. **Effective configuration**: `src/lib/tenants/config.ts` with `resolveTenantConfig`, `isFeatureEnabled` and `limitFor`.
3. **Quota checks**: `src/lib/tenants/quota.ts` with `withQuota` and `assertWithinQuota`, and a `QuotaExceededError` in `src/lib/errors.ts`.
4. **Tests and docs**: `test/config.test.ts` and a section in `README.md`, then `npm test`.
