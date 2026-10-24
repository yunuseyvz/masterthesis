import { test } from "node:test";
import assert from "node:assert/strict";
import { formatGreeting } from "../src/lib/greeting/greeting.ts";

test("greets informally by default", () => {
  assert.equal(formatGreeting({ name: "Ada" }), "Hi Ada!");
});

test("greets formally when asked", () => {
  assert.equal(formatGreeting({ name: "Ada", formal: true }), "Dear Ada,");
});

test("falls back to a generic greeting without a name", () => {
  assert.equal(formatGreeting({ name: "" }), "Hi there!");
});
