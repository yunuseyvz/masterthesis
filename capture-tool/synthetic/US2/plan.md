# Plan: payment webhook with idempotency and retry

## Context

- Balances are in `src/lib/accounts.ts`: `adjustBalance(store, accountId, deltaCents)` on the `AccountStore` from `getDb().accounts`.
- `src/lib/http.ts` has `text()`, `json()` and `errorResponse()`; client errors extend `AppError` (`ValidationError` = 400).
- The provider may send the same event more than once, and processing can fail temporarily.

## Approach

A `src/lib/webhooks/` module: event parsing, a credit handler, an idempotency layer keyed on the event id with retries, and `POST /api/webhooks/payments`. The record of handled events lives in the shared db so it survives across requests.

## Steps

### 1. Add webhook event types and the event log
- `src/lib/webhooks/types.ts`: `WebhookEvent { id; type: "payment.succeeded" | "payment.refunded"; accountId; amountCents }`, `Handler = (event) => Promise<void>`, `EventLog { processed: Set<string> }`, `createEventLog()`.

### 2. Add event parsing and the credit handler
- `src/lib/webhooks/handlers.ts`:
  - `parseEvent(raw: string): WebhookEvent`: JSON body to event; a malformed event → `ValidationError`.
  - `creditHandler(store): Handler`: credits `amountCents` to the account; a refund debits it.

### 3. Implement event deduplication and retry
- `src/lib/webhooks/idempotency.ts`:
  - `processWebhook(log, event, handler): Promise<"processed" | "duplicate">`: runs the handler once per event id; redeliveries are reported as duplicates.
  - `withRetry(fn, attempts)`: calls `fn` up to `attempts` times, rethrows the last error.

### 4. Add the webhook endpoint and unit tests
- `src/lib/webhooks/webhook.ts`: `handleWebhook(log, handler, event)` with 3 attempts → `200 processed|duplicate`, `500 retry later` when all attempts fail (the provider retries on 5xx).
- `src/lib/db.ts`: `webhookEvents: EventLog` in `Db`.
- `src/app/api/webhooks/payments/route.ts`: parse, then `handleWebhook(db.webhookEvents, creditHandler(db.accounts), event)`; parse errors via `errorResponse`.
- `test/webhook.test.ts`: crediting, a duplicate delivery, retry after a transient failure.
- README: add `webhooks/` under "Layout".

## Out of scope

Signature verification of the provider's requests.

Shall I go ahead?
