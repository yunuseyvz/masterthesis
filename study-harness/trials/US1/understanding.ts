// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { NotFoundError, OutOfStockError } from "./src/lib/errors.ts";
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
    const store = createStockStore([{ sku: "mug", stock: 3 }]);
    reserveStock(store, "mug", 3);
    try {
      reserveStock(store, "mug", 2);
    } catch (err) {
      return err instanceof OutOfStockError ? "It is rejected as out of stock" : err instanceof NotFoundError ? "It is rejected: the mug is not found" : "? it throws";
    }
    const left = stockOf(store, "mug");
    return left === 3 ? "It succeeds and the stock stays at 3" : left === -2 ? "It succeeds and the stock goes to -2" : `It succeeds and the stock is ${left}`;
  },
  // step 3
  () => {
    const r = checkout(createStockStore([{ sku: "mug", stock: 3 }]), JSON.stringify({ sku: "mug", quantity: 1 }));
    return Object.keys(r).sort().join() === "quantity,remaining,sku" ? "The SKU, the quantity and the remaining stock" : "?";
  },
  // step 4
  async () => {
    const { POST } = await import("./src/app/api/checkout/route.ts");
    const res: Response = await POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku: "no-such-item", quantity: 1 }) }));
    return { 404: "404 (not found)", 400: "400 (invalid request)", 409: "409 (out of stock)", 500: "500 (server error)" }[res.status] ?? `It answers ${res.status}`;
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
