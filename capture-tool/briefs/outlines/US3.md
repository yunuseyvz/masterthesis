## Step outline: tenant configuration

1. Types and defaults in `src/lib/tenants/types.ts`: a tenant's feature flags and limits, and the organization
   defaults.
2. Configuration merging in `src/lib/tenants/config.ts`: a tenant's effective configuration is the organization
   defaults with the tenant's own overrides applied.
3. Quota checks in `src/lib/tenants/quota.ts`: check a tenant's usage against its effective limit and wrap an
   operation so it fails with a `QuotaExceededError` (add it to `src/lib/errors.ts`, HTTP 429) when the quota is used up.
4. Unit tests in `test/config.test.ts`, a README section, then `npm test`.
