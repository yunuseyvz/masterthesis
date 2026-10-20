// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { createCatalog } from "./src/lib/catalog.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";
import { createOrder } from "./src/lib/orders.ts";

const catalog = createCatalog([{ sku: "A", name: "A", priceCents: 2000 }]);
const order = createOrder("o1", "acc_1", [{ sku: "A", quantity: 3 }]);

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    const r = summarizeOrder(catalog, order, { code: "X", percent: -15 });
    return r.totalCents === r.subtotalCents ? "The total is unchanged: the negative adjustment is ignored" : r.totalCents > r.subtotalCents ? "The total goes up by 15%" : "?";
  },
  // step 2
  async () => {
    const r = summarizeOrder(catalog, order, { code: "T", percent: 10 });
    return r.discountCents === 600 ? "As a percentage, e.g. 10 for 10%" : "?";
  },
  // step 3
  async () => {
    const r = summarizeOrder(catalog, order, { code: "Y", percent: 10 });
    const t = `Subtotal ${r.subtotalCents}, discount ${r.discountCents}, total ${r.totalCents}`;
    return t === "Subtotal 6000, discount 600, total 5400" ? t : "?";
  },
  // step 4
  async () => {
    const t = readFileSync("test/pricing.test.ts", "utf8");
    return /applyDiscount\([^)]*,\s*-\d/.test(t) ? "?" : "A negative discount";
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
