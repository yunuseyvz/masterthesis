import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventLog } from "../src/types.ts";
import { processWebhook, withRetry } from "../src/idempotency.ts";

const event = { id: "evt_1", type: "payment.succeeded" as const, accountId: "acc_1", amountCents: 500 };

test("runs the handler for a new event", async () => {
  const seen: string[] = [];
  const outcome = await processWebhook(createEventLog(), event, async (e) => void seen.push(e.id));
  assert.equal(outcome, "processed");
  assert.deepEqual(seen, ["evt_1"]);
});

test("a redelivered event is skipped", async () => {
  const seen: string[] = [];
  const log = createEventLog();
  const handler = async (e: { id: string }) => void seen.push(e.id);
  await processWebhook(log, event, handler);
  const second = await processWebhook(log, event, handler);
  assert.equal(second, "duplicate");
  assert.equal(seen.length, 1);
});

test("withRetry rethrows after the last attempt", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw new Error("down");
    }, 3),
    /down/,
  );
  assert.equal(calls, 3);
});
