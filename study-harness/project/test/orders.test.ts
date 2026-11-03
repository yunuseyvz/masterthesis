import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../src/lib/catalog.ts";
import { createOrder, orderSubtotal } from "../src/lib/orders.ts";

const catalog = createCatalog([
  { sku: "mug", name: "Mug", priceCents: 1200 },
  { sku: "pen", name: "Pen", priceCents: 300 },
]);

test("computes the subtotal of an order", () => {
  const order = createOrder("o1", "acc_1", [{ sku: "mug", quantity: 2 }, { sku: "pen", quantity: 3 }]);
  assert.equal(orderSubtotal(catalog, order), 3300);
});

test("rejects a zero quantity", () => {
  assert.throws(() => createOrder("o2", "acc_1", [{ sku: "mug", quantity: 0 }]), /invalid quantity/);
});
