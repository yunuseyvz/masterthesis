// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { createInvoice } from "./src/lib/sla/invoice.ts";

const O: string[][] = [["A credit for the 30 minutes beyond the threshold", "No credit: the outage is treated as shorter than the threshold", "A credit for the full 1h30m", "An error because of the duration format"], ["5.0%", "10.0%", "0.0%", "2.5%"], ["15.0%", "10.0%", "5.0%", "20.0%"]];
const idx: number[] = [];
  idx.push(await (async () => { const i = createInvoice("standard", "1h30m"); return i.creditPercent === 2.5 && i.billableMs === 1_800_000 ? 0 : i.creditPercent === 0 ? 1 : i.billableMs === 5_400_000 ? 2 : -1; })());
  idx.push(await (async () => { const p = createInvoice("standard", "2h").creditPercent.toFixed(1) + "%"; return p === "5.0%" ? 0 : p === "10.0%" ? 1 : p === "0.0%" ? 2 : p === "2.5%" ? 3 : -1; })());
  idx.push(await (async () => { const p = createInvoice("premium", "2h").creditPercent.toFixed(1) + "%"; return p === "15.0%" ? 0 : p === "10.0%" ? 1 : p === "5.0%" ? 2 : p === "20.0%" ? 3 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
