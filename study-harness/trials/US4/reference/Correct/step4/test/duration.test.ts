import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDurationMinutes } from "../src/lib/sla/duration.ts";
import { MINUTE_MS, minutesBetween } from "../src/lib/sla/time.ts";

test("parses a single unit", () => {
  assert.equal(parseDurationMinutes("45m"), 45);
  assert.equal(parseDurationMinutes("2h"), 120);
});

test("parses several parts", () => {
  assert.equal(parseDurationMinutes("1h 30m"), 90);
  assert.equal(parseDurationMinutes("2d 4h"), 3120);
  assert.equal(parseDurationMinutes("  1h 15m  "), 75);
});

test("parses seconds and uppercase units", () => {
  assert.equal(parseDurationMinutes("90s"), 1.5);
  assert.equal(parseDurationMinutes("1H 30M"), 90);
});

test("rejects invalid durations", () => {
  assert.throws(() => parseDurationMinutes(""), /empty/);
  assert.throws(() => parseDurationMinutes("45"), /invalid duration part/);
  assert.throws(() => parseDurationMinutes("1x"), /invalid duration part/);
  assert.throws(() => parseDurationMinutes("0m"), /positive/);
  assert.throws(() => parseDurationMinutes("1h 1h"), /duplicate unit/);
});

test("measures minutes between timestamps", () => {
  assert.equal(minutesBetween(0, 90 * MINUTE_MS), 90);
  assert.equal(minutesBetween(0, 30_000), 0.5);
});

test("rejects a reversed interval", () => {
  assert.throws(() => minutesBetween(10, 5), /before start/);
});
