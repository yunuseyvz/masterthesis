import { test } from "node:test";
import assert from "node:assert/strict";
import { OutOfStockError } from "../src/lib/errors.ts";
import { checkout } from "../src/lib/inventory/checkout.ts";
import { reserveStock, stockOf } from "../src/lib/inventory/inventory.ts";
import { createStockStore } from "../src/lib/inventory/types.ts";

const levels = [
  { sku: "mug", stock: 3 },
  { sku: "pen", stock: 1 },
  { sku: "notebook", stock: 0 },
];

test("reserves stock and reports what is left", () => {
  const store = createStockStore(levels);
  assert.equal(reserveStock(store, "mug", 2), 1);
  assert.equal(stockOf(store, "mug"), 1);
  assert.equal(stockOf(store, "notebook"), 0);
});

test("refuses to reserve more than is in stock", () => {
  const store = createStockStore(levels);
  assert.throws(
    () => reserveStock(store, "mug", 4),
    (err: unknown) =>
      err instanceof OutOfStockError && err.status === 409 && /not enough stock for mug/.test(err.message),
  );
  assert.equal(stockOf(store, "mug"), 3);
});

test("an unknown sku is not found", () => {
  const store = createStockStore(levels);
  assert.throws(() => stockOf(store, "hat"), /not found/);
  assert.throws(() => reserveStock(store, "hat", 1), /not found/);
});

test("rejects a quantity that is not a positive integer", () => {
  const store = createStockStore(levels);
  assert.throws(() => reserveStock(store, "mug", 0), /positive integer/);
  assert.throws(() => reserveStock(store, "mug", 1.5), /positive integer/);
});

test("checkout reserves the requested line", () => {
  const store = createStockStore(levels);
  assert.deepEqual(checkout(store, JSON.stringify({ sku: "pen", quantity: 1 })), {
    sku: "pen",
    quantity: 1,
    remaining: 0,
  });
  assert.equal(stockOf(store, "pen"), 0);
});

test("checkout rejects bad bodies and unavailable stock", () => {
  const store = createStockStore(levels);
  assert.throws(() => checkout(store, "nope"), /not valid JSON/);
  assert.throws(() => checkout(store, JSON.stringify({ sku: "mug", quantity: 0 })), /quantity must be/);
  assert.throws(() => checkout(store, JSON.stringify({ sku: "mug", quantity: 9 })), OutOfStockError);
  assert.equal(stockOf(store, "mug"), 3);
});
