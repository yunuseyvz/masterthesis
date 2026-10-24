import { test } from "node:test";
import assert from "node:assert/strict";
import { getEffectiveConfig } from "../src/lib/tenants/config.ts";
import { ORG_DEFAULTS } from "../src/lib/tenants/types.ts";

test("a tenant override wins over the default", () => {
  const cfg = getEffectiveConfig(ORG_DEFAULTS, { plan: "enterprise", rateLimit: 500 });
  assert.equal(cfg.plan, "enterprise");
  assert.equal(cfg.rateLimit, 500);
});

test("without overrides the organization defaults apply", () => {
  assert.deepEqual(getEffectiveConfig(ORG_DEFAULTS, {}), ORG_DEFAULTS);
});

test("a tenant can switch on a flag that is off by default", () => {
  const cfg = getEffectiveConfig({ ...ORG_DEFAULTS, allowExport: false }, { allowExport: true });
  assert.equal(cfg.allowExport, true);
});
