import { OutOfStockError, NotFoundError } from "./src/lib/errors.ts";
import { reserveStock, stockOf } from "./src/lib/inventory/inventory.ts";
import { createStockStore } from "./src/lib/inventory/types.ts";

const store = createStockStore([{ sku: "notebook", stock: 0 }]);
try {
  reserveStock(store, "notebook", 1);
  console.log(stockOf(store, "notebook") === -1 ? "Reserved; the stock becomes -1" : "Reserved; the stock stays 0");
} catch (err) {
  console.log(err instanceof OutOfStockError ? "Rejected with OutOfStockError (409)" : err instanceof NotFoundError ? "Rejected: the notebook is not found (404)" : "?");
}
