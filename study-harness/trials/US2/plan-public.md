Here is the plan for the payment webhook, in four steps.

1. **Types**: `src/lib/webhooks/types.ts` with `PaymentEvent`, `ProcessedStatus`, `EventLog` and `WebhookDeps`, the contract the other steps share.
2. **Parsing and crediting**: `src/lib/webhooks/handlers.ts` with `parsePaymentEvent`, `dollarsToCents` and `applyPayment`.
3. **Processing an event**: `src/lib/webhooks/idempotency.ts` with `processEventOnce`, for redeliveries and temporary failures.
4. **Endpoint, tests and docs**: `handleWebhookRequest` in `src/lib/webhooks/webhook.ts`, the route in `src/app/api/webhooks/payments/route.ts`, `createEventLog` in `src/lib/db.ts`, `test/webhook.test.ts` and a section in `README.md`, then `npm test`.
