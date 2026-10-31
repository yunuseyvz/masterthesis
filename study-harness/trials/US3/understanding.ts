// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { QuotaExceededError } from "./src/lib/errors.ts";
import { limitFor } from "./src/lib/tenants/config.ts";
import { withQuota } from "./src/lib/tenants/quota.ts";
import { ORGANIZATION_DEFAULTS } from "./src/lib/tenants/types.ts";

/** Whether the agent's unit tests notice a mistake: `module` replaced by `mutant`, which wraps the original (`./<name>.orig.ts`). */
function testsNotice(module: string, mutant: string): string {
  const tests = readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`);
  const pass = () => spawnSync(process.execPath, ["--test", ...tests], { encoding: "utf8" }).status === 0;
  if (!pass()) return "? the tests fail without the mistake";
  const original = readFileSync(module, "utf8");
  writeFileSync(module.replace(/\.ts$/, ".orig.ts"), original);
  writeFileSync(module, mutant);
  try {
    return pass() ? "No: all unit tests still pass" : "Yes: at least one unit test fails";
  } finally {
    writeFileSync(module, original);
  }
}

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    const off = Object.entries(ORGANIZATION_DEFAULTS.features).filter(([, on]) => !on).map(([k]) => k);
    return off.length === 0 ? "None" : off.length === 1 ? off[0]! : "?";
  },
  // step 2
  () => String(limitFor({ id: "t", name: "T", overrides: { limits: { maxProducts: 10 } } }, "monthlyOrders")),
  // step 3
  async () => {
    try {
      await withQuota({ id: "t", name: "T", overrides: {} }, "maxProducts", 98, () => "imported", 5);
      return "The import runs";
    } catch (err) {
      return err instanceof QuotaExceededError ? "The import is rejected: quota exceeded (429)" : "?";
    }
  },
  // step 4
  () =>
    testsNotice("src/lib/tenants/config.ts", `import * as orig from "./config.orig.ts";
export * from "./config.orig.ts";
const withoutLimits = (tenant) => ({ ...tenant, overrides: { ...tenant.overrides, limits: undefined } });
export function resolveTenantConfig(tenant, defaults) { return orig.resolveTenantConfig(withoutLimits(tenant), defaults); }
export function limitFor(tenant, name, defaults) { return orig.limitFor(withoutLimits(tenant), name, defaults); }
`),
];
const out: (string | null)[] = [];
for (const item of items) {
  try {
    out.push(await item());
  } catch {
    out.push(null);
  }
}
console.log(JSON.stringify(out));
