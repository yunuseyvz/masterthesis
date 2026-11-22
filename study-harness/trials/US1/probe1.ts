import { createStockStore } from "./src/lib/inventory/types.ts";

try {
  console.log(String(createStockStore([{ sku: "mug", stock: 3 }, { sku: "mug", stock: 5 }]).stock.get("mug")));
} catch {
  console.log("Creating it throws");
}
