// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { createCatalog } from "./src/lib/catalog.ts";
import { createOrder } from "./src/lib/orders.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";
import { discountFor } from "./src/lib/pricing/pricing.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    try {
      return discountFor(999, { code: "FREE", kind: "percentage", value: 100 }) === 999 ? "Yes: the discount is the full price" : "?";
    } catch {
      return "No: a 100% coupon is rejected";
    }
  },
  // step 2
  () => {
    const t = readFileSync("src/lib/pricing/types.ts", "utf8").match(/interface OrderSummary \{([^}]*)\}/)?.[1] ?? "";
    return ["subtotalCents", "discountCents", "totalCents", "coupon"].every((f) => t.includes(f)) ? "Subtotal, discount, total and the coupon" : "?";
  },
  // step 3
  () => {
    const catalog = createCatalog([{ sku: "pen", name: "Pen", priceCents: 300 }]);
    return String(summarizeOrder(catalog, createOrder("o", "a", [{ sku: "pen", quantity: 3 }]), { code: "TEN", kind: "percentage", value: 10 }).totalCents);
  },
  // step 4
  () => {
    const t = readFileSync("test/pricing.test.ts", "utf8");
    return /never discounts more than the subtotal/.test(t) && !/value: 100\b/.test(t) && !/expir/i.test(t) && !/unknown (product|sku)|ghost/i.test(t) ? "A fixed coupon larger than the subtotal" : "?";
  },
];
const out: (string | null)[] = [];
for (const item of items) {
  try {
    out.push(await item());
  } catch {
    out.push(null);
  }
}
console.log(JSON.stringify(out));
