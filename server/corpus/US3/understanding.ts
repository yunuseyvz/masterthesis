// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { getEffectiveConfig } from "./src/lib/tenants/config.ts";
import { checkQuota } from "./src/lib/tenants/quota.ts";
import { ORG_DEFAULTS, createQuotaState } from "./src/lib/tenants/types.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    return getEffectiveConfig(ORG_DEFAULTS, {}).plan;
  },
  // step 2
  async () => {
    const limit = getEffectiveConfig(ORG_DEFAULTS, { rateLimit: 0 }).rateLimit;
    return limit === 0 ? "0" : limit === 100 ? "100" : "?";
  },
  // step 3
  async () => {
    const s = createQuotaState();
    for (let i = 0; i < 100; i++) checkQuota("t2", {}, s);
    const r = checkQuota("t2", {}, s);
    return !r.allowed && r.reason === "rate limit reached" ? 'It is blocked with the reason "rate limit reached"' : r.allowed ? "It is allowed; the counter resets" : "?";
  },
  // step 4
  async () => {
    const t = readFileSync("test/config.test.ts", "utf8");
    const overrides = [...t.matchAll(/getEffectiveConfig\([^)]*?,\s*(\{[^}]*\})\)/g)].map((m) => m[1]!);
    return overrides.length > 0 && overrides.every((o) => !/:\s*(0|false)\b/.test(o)) ? "An override set to 0 or false" : "?";
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
