import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/types.ts";
import { getStock, reserveStock } from "../src/inventory.ts";

test("reserves units that are in stock", () => {
  const store = createStore({ A: 10 });
  assert.equal(reserveStock(store, "A", 3), 7);
  assert.equal(getStock(store, "A"), 7);
});

test("can reserve the entire remaining stock", () => {
  const store = createStore({ A: 4 });
  assert.equal(reserveStock(store, "A", 4), 0);
});

test("successive reservations accumulate", () => {
  const store = createStore({ A: 10 });
  reserveStock(store, "A", 2);
  reserveStock(store, "A", 5);
  assert.equal(getStock(store, "A"), 3);
});
