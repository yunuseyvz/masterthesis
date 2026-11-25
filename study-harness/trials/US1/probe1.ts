import { createStockStore } from "./src/lib/inventory/types.ts";

try {
  console.log(String(createStockStore([{ productId: "mug", stock: 3 }, { productId: "mug", stock: 5 }]).stock.get("mug")));
} catch {
  console.log("Creating it throws");
}
