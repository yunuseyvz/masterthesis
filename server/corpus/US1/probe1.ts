import { OutOfStockError } from "./src/lib/inventory/types.ts";

console.log(String(new OutOfStockError("A", 5).status));
