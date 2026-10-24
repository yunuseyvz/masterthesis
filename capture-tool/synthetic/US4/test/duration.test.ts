import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDurationMs } from "../src/lib/sla/duration.ts";

test("parses hours", () => {
  assert.equal(parseDurationMs("2h"), 7_200_000);
});

test("parses minutes", () => {
  assert.equal(parseDurationMs("45m"), 2_700_000);
});

test("parses seconds", () => {
  assert.equal(parseDurationMs("30s"), 30_000);
});
