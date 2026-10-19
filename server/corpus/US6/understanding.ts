// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { createCatalog } from "./src/lib/catalog.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";
import { createOrder } from "./src/lib/orders.ts";

const catalog = createCatalog([{ sku: "A", name: "A", priceCents: 2000 }]);
const order = createOrder("o1", "acc_1", [{ sku: "A", quantity: 3 }]);

const O: string[][] = [["The total is unchanged: the negative adjustment is ignored", "The total goes up by 15%", "The total goes down by 15%", "Checkout fails with an error"], ["Subtotal 6000, discount 600, total 5400", "Subtotal 6000, discount 600, total 6600", "Subtotal 2000, discount 200, total 1800", "Subtotal 6000, discount 0, total 6000"], ["0: the discount is capped at 100%", "-3000: the total goes negative", "6000: the coupon is ignored", "Checkout fails with an error"]];
const idx: number[] = [];
  idx.push(await (async () => { const r = summarizeOrder(catalog, order, { code: "X", percent: -15 }); return r.totalCents === r.subtotalCents ? 0 : r.totalCents > r.subtotalCents ? 1 : r.totalCents < r.subtotalCents ? 2 : -1; })());
  idx.push(await (async () => { const r = summarizeOrder(catalog, order, { code: "Y", percent: 10 }); const t = `Subtotal ${r.subtotalCents}, discount ${r.discountCents}, total ${r.totalCents}`; return t === "Subtotal 6000, discount 600, total 5400" ? 0 : t === "Subtotal 6000, discount 600, total 6600" ? 1 : t === "Subtotal 2000, discount 200, total 1800" ? 2 : t === "Subtotal 6000, discount 0, total 6000" ? 3 : -1; })());
  idx.push(await (async () => { const r = summarizeOrder(catalog, order, { code: "Z", percent: 150 }); return r.totalCents === 0 ? 0 : r.totalCents === -3000 ? 1 : r.totalCents === 6000 ? 2 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
