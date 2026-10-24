// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { QuotaExceededError } from "./src/lib/errors.ts";
import { limitFor } from "./src/lib/tenants/config.ts";
import { withQuota } from "./src/lib/tenants/quota.ts";
import { ORGANIZATION_DEFAULTS } from "./src/lib/tenants/types.ts";

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
  () => {
    const t = readFileSync("test/config.test.ts", "utf8");
    const calls = t.match(/withQuota\([^]*?\)\s*[,;]/g) ?? [];
    return /does not run/.test(t) && !/negative/i.test(t) && calls.length > 0 ? "An operation over quota does not run" : "?";
  },
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
