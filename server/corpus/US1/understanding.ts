// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { createStore } from "./src/lib/inventory/types.ts";
import { handleCheckout } from "./src/lib/inventory/checkout.ts";

const O: string[][] = [["The valid order succeeds normally; the failed attempt had no effect", "The valid order is rejected as out of stock even though stock was available", "The valid order succeeds but is charged twice", "The endpoint stops responding until the server restarts"], ["Status 404 with an error message", "Status 409: out of stock", "Status 400: invalid quantity", "Status 200 with 0 units remaining"], ["The first two succeed; the third is rejected as out of stock", "All three succeed and the stock goes negative", "Only the first succeeds; the other two are rejected", "The first two succeed and the third gets the 2 remaining units"]];
const idx: number[] = [];
  idx.push(await (async () => { const s = createStore({ A: 5 }); handleCheckout(s, { skuId: "A", qty: 9 }); const r = handleCheckout(s, { skuId: "A", qty: 3 }); return r.status === 200 ? 0 : r.status === 409 ? 1 : -1; })());
  idx.push(await (async () => { const r = handleCheckout(createStore({ A: 5 }), { skuId: "ZZ", qty: 3 }); return r.status === 404 ? 0 : r.status === 409 ? 1 : r.status === 400 ? 2 : r.status === 200 ? 3 : -1; })());
  idx.push(await (async () => { const s = createStore({ A: 10 }); const st = [1, 2, 3].map(() => handleCheckout(s, { skuId: "A", qty: 4 }).status).join(","); return st === "200,200,409" ? 0 : st === "200,200,200" ? 1 : st === "200,409,409" ? 2 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
