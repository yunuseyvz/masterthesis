// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createCatalog } from "./src/lib/catalog.ts";
import { createOrder } from "./src/lib/orders.ts";
import { summarizeOrder } from "./src/lib/pricing/order.ts";
import { discountFor } from "./src/lib/pricing/pricing.ts";

/** Whether the agent's unit tests notice a mistake: `module` replaced by `mutant`, which wraps the original (`./<name>.orig.ts`). */
function testsNotice(module: string, mutant: string): string {
  const tests = readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`);
  const pass = () => spawnSync(process.execPath, ["--test", ...tests], { encoding: "utf8" }).status === 0;
  if (!pass()) return "? the tests fail without the mistake";
  const original = readFileSync(module, "utf8");
  writeFileSync(module.replace(/\.ts$/, ".orig.ts"), original);
  writeFileSync(module, mutant);
  try {
    return pass() ? "No: all unit tests still pass" : "Yes: at least one unit test fails";
  } finally {
    writeFileSync(module, original);
  }
}

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
    const catalog = createCatalog([{ sku: "pen", name: "Pen", priceCents: 300 }]);
    const summary = summarizeOrder(catalog, createOrder("o", "a", [{ sku: "pen", quantity: 1 }]), { code: "TEN", kind: "percentage", value: 10 }) as unknown as Record<string, unknown>;
    const has = (k: string) => k in summary && summary[k] !== undefined;
    if (["subtotalCents", "discountCents", "totalCents", "coupon"].every(has)) return "Subtotal, discount, total and the coupon";
    if (has("totalCents") && !has("subtotalCents") && !has("discountCents")) return "Only the total";
    return `? ${Object.keys(summary).join()}`;
  },
  // step 3
  () => {
    const catalog = createCatalog([{ sku: "pen", name: "Pen", priceCents: 300 }]);
    return String(summarizeOrder(catalog, createOrder("o", "a", [{ sku: "pen", quantity: 3 }]), { code: "TEN", kind: "percentage", value: 10 }).totalCents);
  },
  // step 4
  () =>
    testsNotice("src/lib/pricing/pricing.ts", `import * as orig from "./pricing.orig.ts";
export * from "./pricing.orig.ts";
export function discountFor(amountCents, coupon) {
  return coupon.kind === "fixed" && Number.isInteger(coupon.value) && coupon.value >= 0 ? coupon.value : orig.discountFor(amountCents, coupon);
}
`),
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
