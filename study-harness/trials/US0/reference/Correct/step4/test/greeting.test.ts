import { test } from "node:test";
import assert from "node:assert/strict";
import { formatGreeting } from "../src/lib/greeting/greeting.ts";
import { greetAll } from "../src/lib/greeting/batch.ts";

test("greets a user by the first word of their name", () => {
  assert.equal(formatGreeting({ name: "Ada Lovelace" }), "Hello, Ada!");
});

test("prefers the preferred name when given one", () => {
  assert.equal(
    formatGreeting({ name: "Ada Lovelace", preferredName: "Ada" }),
    "Hello, Ada!",
  );
});

test("falls back to the first name when the preferred name is blank", () => {
  assert.equal(formatGreeting({ name: "Ada Lovelace", preferredName: "  " }), "Hello, Ada!");
});

test("uses the full name in a formal greeting", () => {
  assert.equal(
    formatGreeting({ name: "Ada Lovelace", tone: "formal" }),
    "Good day, Ada Lovelace.",
  );
});

test("trims whitespace around the name", () => {
  assert.equal(formatGreeting({ name: "  Ada Lovelace  " }), "Hello, Ada!");
});

test("rejects a blank name", () => {
  assert.throws(() => formatGreeting({ name: "   " }), /name must be a non-empty string/);
});

test("greets several users in order", () => {
  const greetings = greetAll([
    { name: "Ada Lovelace" },
    { name: "Grace Hopper", tone: "formal" },
  ]);
  assert.deepEqual(greetings, ["Hello, Ada!", "Good day, Grace Hopper."]);
});

test("greets an empty list with no greetings", () => {
  assert.deepEqual(greetAll([]), []);
});
