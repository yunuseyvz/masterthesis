import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustBalance, createAccountStore, getAccount } from "../src/lib/accounts.ts";

const seed = [{ id: "acc_1", name: "Ada", balanceCents: 1000 }];

test("adjusts a balance up and down", () => {
  const store = createAccountStore(seed);
  assert.equal(adjustBalance(store, "acc_1", 500).balanceCents, 1500);
  assert.equal(adjustBalance(store, "acc_1", -200).balanceCents, 1300);
});

test("an unknown account is not found", () => {
  assert.throws(() => getAccount(createAccountStore(seed), "acc_x"), /not found/);
});
