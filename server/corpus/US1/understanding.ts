// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { createStore } from "./src/lib/inventory/types.ts";
import { handleCheckout } from "./src/lib/inventory/checkout.ts";
import { POST } from "./src/app/api/checkout/route.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    const s = createStore({ mug: 20, pen: 5 });
    const e = s.skus.get("cup");
    return e === undefined ? "No entry: the SKU is unknown" : e.stock === 0 ? "An entry with stock 0" : "?";
  },
  // step 2
  async () => {
    const s = createStore({ A: 5 });
    handleCheckout(s, { skuId: "A", qty: 9 });
    const r = handleCheckout(s, { skuId: "A", qty: 3 });
    return r.status === 200 ? "The valid order succeeds normally; the failed attempt had no effect" : r.status === 409 ? "The valid order is rejected as out of stock even though stock was available" : "?";
  },
  // step 3
  async () => {
    const send = (qty: number) => POST(new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify({ skuId: "notebook", qty }) }));
    let sold = 0;
    while (sold < 50 && (await send(1)).status === 200) sold++;
    return sold === 12 ? "12" : sold === 20 ? "20" : sold === 5 ? "5" : sold === 50 ? "There is no limit" : "?";
  },
  // step 4
  async () => {
    const t = readFileSync("test/inventory.test.ts", "utf8");
    return /entire remaining stock/.test(t) && !/throws|OutOfStock|"ZZ"|"A", 0\)/.test(t) ? "Reserving the entire remaining stock" : "?";
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
