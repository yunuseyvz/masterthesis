// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { checkout } from "./src/lib/inventory/checkout.ts";
import { reserveStock, stockOf } from "./src/lib/inventory/inventory.ts";
import { createStockStore } from "./src/lib/inventory/types.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    const v = createStockStore([{ sku: "mug", stock: 3 }]).stock.get("pen");
    return v === undefined ? "No entry" : v === 0 ? "Stock 0" : "?";
  },
  // step 2
  () => {
    const store = createStockStore([{ sku: "pen", stock: 2 }]);
    reserveStock(store, "pen", 2);
    try {
      reserveStock(store, "pen", 1);
    } catch {
      return "It is rejected as out of stock";
    }
    return stockOf(store, "pen") === -1 ? "It succeeds and the stock goes to -1" : "It succeeds and the stock stays at 0";
  },
  // step 3
  () => {
    const r = checkout(createStockStore([{ sku: "mug", stock: 3 }]), JSON.stringify({ sku: "mug", quantity: 1 }));
    return Object.keys(r).sort().join() === "quantity,remaining,sku" ? "The SKU, the quantity and the remaining stock" : "?";
  },
  // step 4
  () => {
    const t = readFileSync("test/inventory.test.ts", "utf8");
    return /more than is in stock/.test(t) && !/reserveStock\(store, "notebook"/.test(t) && !/POST|route/.test(t) && !/same time|concurren/i.test(t) ? "Reserving more than is in stock" : "?";
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
