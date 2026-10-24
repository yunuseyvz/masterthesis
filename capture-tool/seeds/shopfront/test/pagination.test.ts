import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/lib/pagination.ts";

const all = Array.from({ length: 45 }, (_, i) => i);

test("returns the requested page", () => {
  const p = paginate(all, 2, 20);
  assert.equal(p.items[0], 20);
  assert.equal(p.items.length, 20);
  assert.equal(p.total, 45);
});

test("the last page may be short", () => {
  assert.equal(paginate(all, 3, 20).items.length, 5);
});

test("rejects a page size above the maximum", () => {
  assert.throws(() => paginate(all, 1, 500), /pageSize/);
});
