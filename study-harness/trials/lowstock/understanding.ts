// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { createCatalog } from "./src/lib/catalog.ts";
import { getDb } from "./src/lib/db.ts";
import { lowStockReport } from "./src/lib/lowStock.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    const products = [...getDb().catalog.products.values()].sort((a, b) => a.stock - b.stock);
    return products[0]!.stock === products.at(-1)!.stock ? "All have the same stock" : products[0]!.name;
  },
  // step 2
  () => {
    const catalog = createCatalog([
      { sku: "a", name: "A", priceCents: 100, stock: 15 },
      { sku: "b", name: "B", priceCents: 100, stock: 2 },
    ]);
    const report = lowStockReport(catalog, 20);
    if (report.length === 0) return "Neither: the report is empty";
    if (report.length === 1) return "Neither: only the one with 2 units is listed";
    return report[0]!.stock === 2 ? "The one with 2 units" : "The one with 15 units";
  },
  // step 3
  () => {
    const link = readFileSync("src/components/Header.tsx", "utf8").match(/<Link href="([^"]+)">Low stock<\/Link>/);
    return link ? link[1]! : "No link was added";
  },
  // step 4
  () => {
    const t = readFileSync("test/lowStock.test.ts", "utf8");
    return /exactly the threshold/.test(t) && !/GET|route|"abc"|getProduct|NotFound/.test(t) ? "A product with exactly the threshold in stock" : "?";
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
