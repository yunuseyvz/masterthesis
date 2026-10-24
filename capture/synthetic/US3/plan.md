# Plan: per-tenant feature flags and quotas

## Context

- No tenant concept exists yet. Shared modules live in `src/lib/`; client-facing errors extend `AppError` in `src/lib/errors.ts`.
- The organization defaults decide the plan, the export flag, the request rate limit and the seat count.

## Approach

A `src/lib/tenants/` module: the configuration type with organization defaults, a merge of a tenant's overrides over those defaults, and quota checks built on the merged configuration.

## Steps

### 1. Add tenant configuration types and organization defaults
- `src/lib/tenants/types.ts`: `TenantConfig { plan; allowExport; rateLimit; seats }`, `Overrides = Partial<TenantConfig>`, `ORG_DEFAULTS` (team plan, export allowed, 100 requests, 10 seats), `QuotaState { used: Map<string, number> }`, `createQuotaState()`.

### 2. Implement tenant configuration merging
- `src/lib/tenants/config.ts`: `getEffectiveConfig(base, override): TenantConfig`, one value per key of the defaults: the tenant's own value where it set one, the organization default otherwise.

### 3. Add quota checks and a quota wrapper
- `src/lib/tenants/quota.ts`:
  - `checkQuota(tenantId, overrides, state): { allowed; reason? }` counts the tenant's calls against its effective `rateLimit`.
  - `withQuota(tenantId, overrides, state, fn)` wraps a function and throws `QuotaExceededError` when the check fails.
  - `exportAllowed(overrides)`, `resetQuota(state)`.
- `src/lib/errors.ts`: `QuotaExceededError extends AppError` (429).

### 4. Add unit tests for configuration and quotas
- `test/config.test.ts`: overrides win over defaults, defaults fill the rest, the wrapper passes calls through while under quota.
- README: add `tenants/` under "Layout".

## Out of scope

Persisting overrides and resetting quotas on a schedule; `resetQuota` is there for that later.

Shall I go ahead?
