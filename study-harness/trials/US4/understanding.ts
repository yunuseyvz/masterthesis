// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseDurationMinutes } from "./src/lib/sla/duration.ts";
import { generateInvoice } from "./src/lib/sla/invoice.ts";
import { DEFAULT_POLICY, DEFAULT_TIERS } from "./src/lib/sla/types.ts";

const MIN = 60_000;
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
    try {
      return `? ${parseDurationMinutes("90")}`;
    } catch {
      return "It is rejected";
    }
  },
  // step 2
  () => {
    const tier = DEFAULT_TIERS.filter((t) => 300 >= t.minOutageMinutes).sort((a, b) => b.minOutageMinutes - a.minOutageMinutes)[0];
    return tier ? `${tier.creditPercent}% of the subtotal` : "Nothing";
  },
  // step 3
  () => {
    const day = 24 * 60 * MIN;
    const invoice = generateInvoice({ accountId: "a", periodStartMs: 10 * day, periodEndMs: 40 * day, subtotalCents: 10_000, policy: DEFAULT_POLICY, outages: [{ id: "o", startedAt: 7 * day, endedAt: 10 * day + 60 * MIN }] });
    return invoice.creditCents === 500 ? "5% of the subtotal (for the hour inside the period)" : invoice.creditCents === 0 ? "Nothing: the outage is skipped" : invoice.creditCents === 2500 ? "25% of the subtotal (for the whole outage)" : "?";
  },
  // step 4
  () =>
    testsNotice("src/lib/sla/duration.ts", `import * as orig from "./duration.orig.ts";
export * from "./duration.orig.ts";
export function parseDurationMinutes(input) { return /^\\s*\\d+\\s*$/.test(input) ? Number(input) : orig.parseDurationMinutes(input); }
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
