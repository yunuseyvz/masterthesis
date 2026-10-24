import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuditLog } from "../src/lib/audit.ts";
import { fakeClock } from "../src/lib/clock.ts";
import { createEmitter } from "../src/lib/events.ts";
import { createIdGenerator } from "../src/lib/ids.ts";

test("records entries with the current time", () => {
  const clock = fakeClock(1000);
  const log = createAuditLog(clock);
  log.record("ada", "refund", "order_1");
  clock.advance(500);
  log.record("bob", "cancel", "order_2");
  assert.equal(log.entries[1]!.at, 1500);
  assert.equal(log.forTarget("order_1").length, 1);
});

test("an emitter notifies listeners until they unsubscribe", () => {
  const seen: number[] = [];
  const emitter = createEmitter<number>();
  const off = emitter.on((n) => seen.push(n));
  emitter.emit(1);
  off();
  emitter.emit(2);
  assert.deepEqual(seen, [1]);
});

test("ids are sequential and padded", () => {
  const next = createIdGenerator("ord");
  assert.equal(next(), "ord_0001");
  assert.equal(next(), "ord_0002");
});
