import { test } from "node:test";
import assert from "node:assert/strict";
import { isFeatureEnabled, limitFor, resolveSellerConfig } from "../src/lib/sellers/config.ts";
import { assertWithinLimit, withinLimit } from "../src/lib/sellers/limits.ts";
import {
  SHOP_DEFAULTS,
  type Seller,
  type SellerOverrides,
} from "../src/lib/sellers/types.ts";
import { LimitExceededError } from "../src/lib/errors.ts";

function seller(overrides: SellerOverrides = {}): Seller {
  return { id: "t1", name: "Acme", overrides };
}

test("a seller without overrides gets the shop defaults", () => {
  assert.deepEqual(resolveSellerConfig(seller()), SHOP_DEFAULTS);
});

test("overriding one feature leaves the other features and every limit at the defaults", () => {
  const config = resolveSellerConfig(seller({ features: { analytics: true, refunds: false } }));
  assert.equal(config.features.checkout, SHOP_DEFAULTS.features.checkout);
  assert.equal(config.features.refunds, false);
  assert.equal(config.features.analytics, true);
  assert.deepEqual(config.limits, SHOP_DEFAULTS.limits);
});

test("overriding one limit leaves the features and the other limits at the defaults", () => {
  const config = resolveSellerConfig(seller({ limits: { maxProducts: 10 } }));
  assert.equal(config.limits.maxProducts, 10);
  assert.equal(config.limits.maxUsers, SHOP_DEFAULTS.limits.maxUsers);
  assert.equal(config.limits.monthlyOrders, SHOP_DEFAULTS.limits.monthlyOrders);
  assert.deepEqual(config.features, SHOP_DEFAULTS.features);
});

test("resolving a seller does not mutate the shop defaults", () => {
  const config = resolveSellerConfig(seller({ features: { checkout: false } }));
  config.features.checkout = true;
  config.limits.maxUsers = 99;
  assert.equal(SHOP_DEFAULTS.features.checkout, true);
  assert.equal(SHOP_DEFAULTS.limits.maxUsers, 5);
});

test("feature and limit reads go through the seller's effective config", () => {
  const acme = seller({ features: { analytics: true }, limits: { maxUsers: 3 } });
  assert.equal(isFeatureEnabled(acme, "analytics"), true);
  assert.equal(isFeatureEnabled(acme, "checkout"), true);
  assert.equal(limitFor(acme, "maxUsers"), 3);
  assert.equal(limitFor(acme, "maxProducts"), SHOP_DEFAULTS.limits.maxProducts);
});

test("a seller can raise a limit above the shop default", () => {
  assert.equal(limitFor(seller({ limits: { maxUsers: 20 } }), "maxUsers"), 20);
});

test("a limit set to null falls back to the shop default", () => {
  assert.equal(limitFor(seller({ limits: { maxUsers: null } }), "maxUsers"), SHOP_DEFAULTS.limits.maxUsers);
});

test("the limit check allows usage up to the limit", () => {
  assert.doesNotThrow(() => assertWithinLimit(2, 1));
  assert.doesNotThrow(() => assertWithinLimit(2, 0, 2));
  assert.throws(() => assertWithinLimit(2, 1, 2), LimitExceededError);
});

test("an operation within limit runs and returns its result", async () => {
  const acme = seller({ limits: { maxUsers: 2 } });
  const result = await withinLimit(acme, "maxUsers", 1, () => "created");
  assert.equal(result, "created");
});

test("an operation over limit fails with a 429 and does not run", async () => {
  const acme = seller({ limits: { maxUsers: 2 } });
  let called = false;
  await assert.rejects(
    () =>
      withinLimit(acme, "maxUsers", 2, () => {
        called = true;
        return "created";
      }),
    (err: unknown) => {
      assert.ok(err instanceof LimitExceededError);
      assert.equal(err.status, 429);
      return true;
    },
  );
  assert.equal(called, false);
});

test("limit checks also wrap async operations", async () => {
  const result = await withinLimit(seller({ limits: { monthlyOrders: 5 } }), "monthlyOrders", 4, async () => {
    await Promise.resolve();
    return 7;
  });
  assert.equal(result, 7);
});
