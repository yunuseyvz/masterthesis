import { discountFor } from "./src/lib/pricing/pricing.ts";

try {
  console.log(String(discountFor(1200, { code: "FREE", kind: "percentage", value: 100 })));
} catch (err) {
  console.log(/exceed 100/.test(String(err)) ? "It throws: the coupon cannot exceed 100" : "?");
}
