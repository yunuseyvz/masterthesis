// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { parseDurationMs } from "./src/lib/sla/duration.ts";
import { createInvoice } from "./src/lib/sla/invoice.ts";
import { TIERS } from "./src/lib/sla/types.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    try {
      const ms = parseDurationMs("1h 30m");
      return ms === 5_400_000 ? "Reads it as 1h30m" : ms === 1_800_000 ? "Reads it as 30m" : ms === 3_600_000 ? "Reads it as 1h" : "?";
    } catch {
      return "Rejects it as an invalid duration";
    }
  },
  // step 2
  async () => {
    return `${TIERS.premium!.creditPercentPerHour}%`;
  },
  // step 3
  async () => {
    return createInvoice("standard", "2h").creditPercent.toFixed(1) + "%";
  },
  // step 4
  async () => {
    const t = readFileSync("test/duration.test.ts", "utf8");
    return /"\d+[hms]\d+[hms]/.test(t) ? "?" : 'A combined duration such as "1h30m"';
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
