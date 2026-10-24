// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { parseDurationMinutes } from "./src/lib/sla/duration.ts";
import { generateInvoice } from "./src/lib/sla/invoice.ts";
import { DEFAULT_POLICY, DEFAULT_TIERS } from "./src/lib/sla/types.ts";

const MIN = 60_000;
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
  () => {
    const t = readFileSync("test/sla.test.ts", "utf8");
    return /rounds credits down/.test(t) && !/overlap/i.test(t) && !/week/i.test(t) && !/more than the subtotal|exceed/i.test(t) ? "Rounding the credit down to whole cents" : "?";
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
