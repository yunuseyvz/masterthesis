import { test } from "node:test";
import assert from "node:assert/strict";
import { isFeatureEnabled, limitFor, resolveTenantConfig } from "../src/lib/tenants/config.ts";
import { assertWithinQuota, withQuota } from "../src/lib/tenants/quota.ts";
import {
  ORGANIZATION_DEFAULTS,
  type Tenant,
  type TenantOverrides,
} from "../src/lib/tenants/types.ts";
import { QuotaExceededError } from "../src/lib/errors.ts";

function tenant(overrides: TenantOverrides = {}): Tenant {
  return { id: "t1", name: "Acme", overrides };
}

test("a tenant without overrides gets the organization defaults", () => {
  assert.deepEqual(resolveTenantConfig(tenant()), ORGANIZATION_DEFAULTS);
});

test("overriding one flag leaves the other flags and every limit at the defaults", () => {
  const config = resolveTenantConfig(tenant({ features: { analytics: true, refunds: false } }));
  assert.equal(config.features.checkout, ORGANIZATION_DEFAULTS.features.checkout);
  assert.equal(config.features.refunds, false);
  assert.equal(config.features.analytics, true);
  assert.deepEqual(config.limits, ORGANIZATION_DEFAULTS.limits);
});

test("overriding one limit leaves the flags and the other limits at the defaults", () => {
  const config = resolveTenantConfig(tenant({ limits: { maxProducts: 10 } }));
  assert.equal(config.limits.maxProducts, 10);
  assert.equal(config.limits.maxUsers, ORGANIZATION_DEFAULTS.limits.maxUsers);
  assert.equal(config.limits.monthlyOrders, ORGANIZATION_DEFAULTS.limits.monthlyOrders);
  assert.deepEqual(config.features, ORGANIZATION_DEFAULTS.features);
});

test("resolving a tenant does not mutate the organization defaults", () => {
  const config = resolveTenantConfig(tenant({ features: { checkout: false } }));
  config.features.checkout = true;
  config.limits.maxUsers = 99;
  assert.equal(ORGANIZATION_DEFAULTS.features.checkout, true);
  assert.equal(ORGANIZATION_DEFAULTS.limits.maxUsers, 5);
});

test("feature and limit reads go through the tenant's effective config", () => {
  const acme = tenant({ features: { analytics: true }, limits: { maxUsers: 3 } });
  assert.equal(isFeatureEnabled(acme, "analytics"), true);
  assert.equal(isFeatureEnabled(acme, "checkout"), true);
  assert.equal(limitFor(acme, "maxUsers"), 3);
  assert.equal(limitFor(acme, "maxProducts"), ORGANIZATION_DEFAULTS.limits.maxProducts);
});

test("a tenant can raise a limit above the organization default", () => {
  assert.equal(limitFor(tenant({ limits: { maxUsers: 20 } }), "maxUsers"), 20);
});

test("a limit set to null falls back to the organization default", () => {
  assert.equal(limitFor(tenant({ limits: { maxUsers: null } }), "maxUsers"), ORGANIZATION_DEFAULTS.limits.maxUsers);
});

test("the quota check allows usage up to the limit", () => {
  assert.doesNotThrow(() => assertWithinQuota(2, 1));
  assert.doesNotThrow(() => assertWithinQuota(2, 0, 2));
  assert.throws(() => assertWithinQuota(2, 1, 2), QuotaExceededError);
});

test("an operation within quota runs and returns its result", async () => {
  const acme = tenant({ limits: { maxUsers: 2 } });
  const result = await withQuota(acme, "maxUsers", 1, () => "created");
  assert.equal(result, "created");
});

test("an operation over quota fails with a 429 and does not run", async () => {
  const acme = tenant({ limits: { maxUsers: 2 } });
  let called = false;
  await assert.rejects(
    () =>
      withQuota(acme, "maxUsers", 2, () => {
        called = true;
        return "created";
      }),
    (err: unknown) => {
      assert.ok(err instanceof QuotaExceededError);
      assert.equal(err.status, 429);
      return true;
    },
  );
  assert.equal(called, false);
});

test("quota checks also wrap async operations", async () => {
  const result = await withQuota(tenant({ limits: { monthlyOrders: 5 } }), "monthlyOrders", 4, async () => {
    await Promise.resolve();
    return 7;
  });
  assert.equal(result, 7);
});
