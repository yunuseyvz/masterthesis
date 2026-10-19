// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { ORG_DEFAULTS, createQuotaState } from "./src/lib/tenants/types.ts";
import { getEffectiveConfig } from "./src/lib/tenants/config.ts";
import { checkQuota } from "./src/lib/tenants/quota.ts";

const O: string[][] = [["All of the tenant's requests are blocked", "Requests are still allowed, up to the organization default of 100", "Requests are allowed but logged for review", "Only the first request is blocked"], ["It is blocked with the reason \"rate limit reached\"", "It is allowed; the counter resets", "It is allowed but logged for review", "It is blocked only if exports are disabled"], ["plan: team, allowExport: true, rateLimit: 100, seats: 25", "plan: team, allowExport: true, rateLimit: 0, seats: 25", "Only seats: 25; every other setting is undefined", "plan: team, allowExport: false, rateLimit: 100, seats: 10"]];
const idx: number[] = [];
  idx.push(await (async () => { const r = checkQuota("t1", { rateLimit: 0 }, createQuotaState()); return r.allowed ? 1 : 0; })());
  idx.push(await (async () => { const s = createQuotaState(); for (let i = 0; i < 100; i++) checkQuota("t2", {}, s); const r = checkQuota("t2", {}, s); return !r.allowed && r.reason === "rate limit reached" ? 0 : r.allowed ? 1 : -1; })());
  idx.push(await (async () => { const c = getEffectiveConfig(ORG_DEFAULTS, { seats: 25 }); const t = `plan: ${c.plan}, allowExport: ${c.allowExport}, rateLimit: ${c.rateLimit}, seats: ${c.seats}`; return t === "plan: team, allowExport: true, rateLimit: 100, seats: 25" ? 0 : t === "plan: team, allowExport: true, rateLimit: 0, seats: 25" ? 1 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
