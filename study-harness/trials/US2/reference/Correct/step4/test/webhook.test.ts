import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/webhooks/payments/route.ts";
import { createAccountStore, getAccount } from "../src/lib/accounts.ts";
import { fakeClock } from "../src/lib/clock.ts";
import { createEventLog, resetDb } from "../src/lib/db.ts";
import { applyPayment, dollarsToCents, parsePaymentEvent } from "../src/lib/webhooks/handlers.ts";
import { processEventOnce } from "../src/lib/webhooks/idempotency.ts";
import { handleWebhookRequest } from "../src/lib/webhooks/webhook.ts";
import type { PaymentEvent, WebhookDeps } from "../src/lib/webhooks/types.ts";

const noWait = async () => {};

const event: PaymentEvent = {
  id: "evt_1",
  type: "payment.succeeded",
  accountId: "acc_1",
  amount: "15.00",
};

function makeDeps(maxAttempts = 3): WebhookDeps {
  return {
    accounts: createAccountStore([{ id: "acc_1", name: "Ada", balanceCents: 1000 }]),
    log: createEventLog(fakeClock()),
    clock: fakeClock(),
    maxAttempts,
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/webhooks/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("converts a decimal dollar string to integer cents", () => {
  assert.equal(dollarsToCents("15.00"), 1500);
  assert.equal(dollarsToCents("0.99"), 99);
  assert.equal(dollarsToCents("15"), 1500);
  assert.equal(dollarsToCents("15.5"), 1550);
  assert.equal(dollarsToCents("1234567.89"), 123456789);
});

test("rejects malformed or non-positive amounts", () => {
  for (const amount of ["15.001", "-1.00", "abc", "", "1,00", "0.00"]) {
    assert.throws(() => dollarsToCents(amount), /amount/);
  }
});

test("parses a valid event and rejects other event types", () => {
  assert.deepEqual(parsePaymentEvent({ ...event }), event);
  assert.throws(
    () => parsePaymentEvent({ ...event, type: "payment.failed" }),
    /type must be payment.succeeded/,
  );
  assert.throws(() => parsePaymentEvent({ ...event, accountId: "" }), /accountId/);
});

test("delivering the same event twice credits the account once", async () => {
  const deps = makeDeps();

  const first = await processEventOnce(deps, event, applyPayment, noWait);
  assert.equal(first.duplicate, false);
  assert.equal(first.account?.balanceCents, 2500);

  const second = await processEventOnce(deps, event, applyPayment, noWait);
  assert.equal(second.duplicate, true);
  assert.equal(getAccount(deps.accounts, "acc_1").balanceCents, 2500);
  assert.equal(deps.log.get("evt_1")?.status, "processed");
});

test("retries a temporary failure and credits exactly once", async () => {
  const deps = makeDeps();
  let calls = 0;
  const flaky = (d: WebhookDeps, e: PaymentEvent) => {
    calls += 1;
    if (calls < 3) throw new Error("gateway unavailable");
    return applyPayment(d, e);
  };

  const result = await processEventOnce(deps, event, flaky, noWait);
  assert.equal(result.attempts, 3);
  assert.equal(getAccount(deps.accounts, "acc_1").balanceCents, 2500);
  assert.equal(deps.log.get("evt_1")?.status, "processed");
});

test("gives up after the attempt limit without crediting", async () => {
  const deps = makeDeps(3);
  let calls = 0;
  const broken = () => {
    calls += 1;
    throw new Error("gateway unavailable");
  };

  await assert.rejects(processEventOnce(deps, event, broken, noWait), /gateway unavailable/);
  assert.equal(calls, 3);
  assert.equal(deps.log.get("evt_1")?.status, "failed");
  assert.equal(getAccount(deps.accounts, "acc_1").balanceCents, 1000);

  // A later redelivery of a failed event may be processed.
  const retried = await processEventOnce(deps, event, applyPayment, noWait);
  assert.equal(retried.duplicate, false);
  assert.equal(getAccount(deps.accounts, "acc_1").balanceCents, 2500);
});

test("does not retry permanent errors such as an unknown account", async () => {
  const deps = makeDeps();
  let calls = 0;
  const handler = (d: WebhookDeps, e: PaymentEvent) => {
    calls += 1;
    return applyPayment(d, e);
  };

  await assert.rejects(
    processEventOnce(deps, { ...event, accountId: "acc_x" }, handler, noWait),
    /not found/,
  );
  assert.equal(calls, 1);
  assert.equal(deps.log.get("evt_1")?.status, "failed");
  assert.equal(deps.accounts.accounts.size, 1);
});

test("the webhook handler returns 200 with the new balance", async () => {
  const deps = makeDeps();
  const response = await handleWebhookRequest(post({ ...event, amount: "15" }), deps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, duplicate: false, balanceCents: 2500 });
});

test("the webhook handler acknowledges a duplicate without crediting again", async () => {
  const deps = makeDeps();
  await handleWebhookRequest(post(event), deps);

  const response = await handleWebhookRequest(post(event), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.equal(getAccount(deps.accounts, "acc_1").balanceCents, 2500);
});

test("the webhook handler rejects a malformed payload", async () => {
  const deps = makeDeps();

  const badAmount = await handleWebhookRequest(post({ ...event, amount: "15.001" }), deps);
  assert.equal(badAmount.status, 400);

  const badJson = await handleWebhookRequest(
    new Request("http://localhost/api/webhooks/payments", { method: "POST", body: "{not json" }),
    deps,
  );
  assert.equal(badJson.status, 400);
});

test("the webhook handler answers 404 for an unknown account", async () => {
  const deps = makeDeps();

  const response = await handleWebhookRequest(post({ ...event, accountId: "acc_x" }), deps);
  assert.equal(response.status, 404);
});

test("the payment route credits the shared account store", async () => {
  resetDb();

  const response = await POST(post({ ...event, amount: "5.00" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).balanceCents, 500);
});
