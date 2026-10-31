import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonObject, requireInt, requireOneOf, requireString } from "../src/lib/validation.ts";

test("requires a non-empty string", () => {
  assert.equal(requireString("abc", "name"), "abc");
  assert.throws(() => requireString("  ", "name"), /name must be/);
});

test("requires an integer above a minimum", () => {
  assert.equal(requireInt(3, "qty", 1), 3);
  assert.throws(() => requireInt(0, "qty", 1), /qty must be/);
  assert.throws(() => requireInt(1.5, "qty"), /qty must be/);
});

test("requires one of a set of values", () => {
  assert.equal(requireOneOf("a", "kind", ["a", "b"] as const), "a");
  assert.throws(() => requireOneOf("c", "kind", ["a", "b"] as const), /kind must be/);
});

test("parses a JSON object body", () => {
  assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 });
  assert.throws(() => parseJsonObject("nope"), /not valid JSON/);
  assert.throws(() => parseJsonObject("[1]"), /must be a JSON object/);
});
