## Step outline: tenant configuration

1. Types and defaults in `src/lib/tenants/types.ts`: `TenantFeatureFlags` (`checkout`, `refunds`, `analytics`),
   `TenantLimits` (`maxUsers`, `maxProducts`, `monthlyOrders`), `TenantConfig` (`features`, `limits`),
   `TenantOverrides` (partial features, and partial limits where a limit may also be `null`), `Tenant` (`id`,
   `name`, `overrides`), and `ORGANIZATION_DEFAULTS`: checkout and refunds on, analytics off; 5 users, 100 products,
   1000 orders a month.
2. Configuration merging in `src/lib/tenants/config.ts`: `resolveTenantConfig(tenant, defaults =
   ORGANIZATION_DEFAULTS)` returns the organization defaults with the tenant's own overrides applied, field by
   field. A limit set to `null` counts as not set, so the organization default applies: an effective limit is always
   a number. `isFeatureEnabled(tenant, flag)` and `limitFor(tenant, name)` read one value of it.
3. Quota checks in `src/lib/tenants/quota.ts`: `withQuota(tenant, name, used, operation, amount = 1)` runs the
   operation only if the tenant still has room for one more operation (`used + 1` within its effective limit):
   a bulk operation counts as one operation against the quota, whatever its `amount`. Otherwise it fails with a
   `QuotaExceededError` (add it to `src/lib/errors.ts`, HTTP 429) without running it. Put the check itself in
   `assertWithinQuota(limit, used, amount = 1, label)`.
4. Unit tests in `test/config.test.ts`, a README section, then `npm test`.
