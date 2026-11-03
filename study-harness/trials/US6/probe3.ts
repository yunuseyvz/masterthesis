import { createCatalog } from "./src/lib/catalog.ts";
import { createOrder } from "./src/lib/orders.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";

const catalog = createCatalog([{ sku: "mug", name: "Mug", priceCents: 1200 }]);
try {
  console.log(String(summarizeOrder(catalog, createOrder("o", "a", [{ sku: "mug", quantity: 2 }]), { code: "X", kind: "fixed", value: 3000 }).totalCents));
} catch {
  console.log("It throws");
}
