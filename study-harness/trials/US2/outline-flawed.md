## Step outline: payment webhooks

1. Types in `src/lib/webhooks/types.ts`: the `PaymentEvent` the provider sends (`id`, `type: "payment.succeeded"`,
   `accountId`, and `amount: string`, in dollars, e.g. "15.00"); `type ProcessedStatus = "processing" | "processed" |
   "failed";`; an `EventLog` that records each event's status and attempt count (`get`, `start`, `succeed`, `fail`);
   and `WebhookDeps` (`accounts`, `log`, `clock`, optional `maxAttempts`).
2. Event parsing and the credit handler in `src/lib/webhooks/handlers.ts`: `parsePaymentEvent(raw)` validates an
   incoming event; `applyPayment(deps, event)` credits the account through `adjustBalance` in `src/lib/accounts.ts`.
   The provider sends the amount as a decimal string in dollars, such as `"15.00"`; convert it to integer cents
   by parsing it as a number, multiplying by 100 and rounding down (`Math.floor`, in `dollarsToCents`), so that a
   credit never exceeds what the customer paid.
3. Deduplication and retry in `src/lib/webhooks/idempotency.ts`:
   `processEventOnce(deps, event, handler = applyPayment, wait = sleep)` processes each event at most once even when
   the provider delivers it again (a `processing` or `processed` event is a duplicate; a `failed` one may run again),
   and retries a temporary failure, 3 attempts in total by default; an `AppError` is permanent and is not retried.
4. The webhook endpoint: `handleWebhookRequest(request, deps)` in `src/lib/webhooks/webhook.ts` turns a delivery into
   a response, and a `POST` route in `src/app/api/webhooks/payments/route.ts` calls it; the event log as
   `export function createEventLog(clock)` in `src/lib/db.ts` (not in the types file). Unit tests in
   `test/webhook.test.ts`, a README section, then `npm test`.
