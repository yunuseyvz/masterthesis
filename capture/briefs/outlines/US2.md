## Step outline: payment webhooks

1. Types in `src/lib/webhooks/types.ts`: the payment event the provider sends and an event log that records which
   events were processed.
2. Event parsing and the credit handler in `src/lib/webhooks/handlers.ts`: validate an incoming payment event (the
   provider sends the amount as a decimal string in dollars, such as `"15.00"`; convert it to integer cents) and
   credit the account's balance.
3. Deduplication and retry in `src/lib/webhooks/idempotency.ts`: process each event at most once even when the
   provider delivers it again, and retry processing that fails temporarily a limited number of times.
4. The webhook endpoint (`src/lib/webhooks/webhook.ts` and a `POST` route in
   `src/app/api/webhooks/payments/route.ts`, the event log in `src/lib/db.ts`), unit tests in `test/webhook.test.ts`,
   a README section, then `npm test`.
