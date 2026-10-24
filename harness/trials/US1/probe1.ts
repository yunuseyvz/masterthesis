import { OutOfStockError } from "./src/lib/errors.ts";

console.log(String(new OutOfStockError("mug", 1, 0).status));
