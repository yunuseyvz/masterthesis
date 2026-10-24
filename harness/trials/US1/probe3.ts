import { AppError } from "./src/lib/errors.ts";
import { checkout } from "./src/lib/inventory/checkout.ts";
import { createStockStore } from "./src/lib/inventory/types.ts";

const store = createStockStore([{ sku: "mug", stock: 3 }]);
try {
  const r = checkout(store, JSON.stringify({ sku: "mug", quantity: "2" }));
  console.log(r.quantity === 2 ? "2 mugs are reserved" : "1 mug is reserved");
} catch (err) {
  console.log(err instanceof AppError ? `Rejected with ${err.status}` : "?");
}
