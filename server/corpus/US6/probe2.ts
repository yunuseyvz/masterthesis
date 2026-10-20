import { createCatalog } from "./src/lib/catalog.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";
import { createOrder } from "./src/lib/orders.ts";

const catalog = createCatalog([{ sku: "A", name: "A", priceCents: 2000 }]);
const s = summarizeOrder(catalog, createOrder("o1", "acc_1", [{ sku: "A", quantity: 3 }]));
const keys = Object.keys(s).sort().join(",");
console.log(keys === "discountCents,subtotalCents,totalCents" ? "Subtotal, discount and total" : keys === "subtotalCents,totalCents" ? "Subtotal and total only" : "?");
