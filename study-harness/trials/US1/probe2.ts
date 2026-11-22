import { NotFoundError, OutOfStockError } from "./src/lib/errors.ts";
import { reserveStock, stockOf } from "./src/lib/inventory/inventory.ts";
import { createStockStore } from "./src/lib/inventory/types.ts";

const store = createStockStore([{ sku: "pen", stock: 2 }]);
reserveStock(store, "pen", 2);
try {
  console.log(String(stockOf(store, "pen")));
} catch (err) {
  console.log(err instanceof NotFoundError ? "The pen does not exist (404)" : err instanceof OutOfStockError ? "Out of stock (409)" : "? it throws");
}
