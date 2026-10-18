import { createStore } from "./src/types.ts";
import { getStock, reserveStock } from "./src/inventory.ts";

const store = createStore({ A: 2 });
try {
  reserveStock(store, "A", 5);
} catch {
  // the reservation is expected to fail
}
console.log(String(getStock(store, "A")));
