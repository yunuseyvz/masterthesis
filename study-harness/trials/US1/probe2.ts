import { NotFoundError, OutOfStockError } from "./src/lib/errors.ts";
import { reserveStock, stockOf } from "./src/lib/inventory/inventory.ts";
import { createStockStore } from "./src/lib/inventory/types.ts";

const store = createStockStore([{ sku: "pen", stock: 2 }]);
reserveStock(store, "pen", 2);
try {
  reserveStock(store, "pen", 1);
  const left = stockOf(store, "pen");
  console.log(left === 2 ? "Reserved; the stock stays at 2" : left === -1 ? "Reserved; the stock becomes -1" : `Reserved; the stock is ${left}`);
} catch (err) {
  console.log(err instanceof OutOfStockError ? "Rejected with OutOfStockError (409)" : err instanceof NotFoundError ? "Rejected: the pen is not found (404)" : "? it throws");
}
