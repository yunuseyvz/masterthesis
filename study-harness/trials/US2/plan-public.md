Here is the plan for the payment notifications, in four steps.

1. **Types**: `src/lib/payments/types.ts` with `PaymentEvent`, `ProcessedStatus`, `EventLog` and `PaymentDeps`, the contract the other steps share.
2. **Parsing and crediting**: `src/lib/payments/handlers.ts` with `parsePaymentEvent`, `dollarsToCents` and `applyPayment`.
3. **Processing an event**: `src/lib/payments/once.ts` with `processEventOnce`, for repeated deliveries and temporary failures.
4. **Endpoint, tests and docs**: `handlePaymentRequest` in `src/lib/payments/receive.ts`, the route in `src/app/api/payments/route.ts`, `createEventLog` in `src/lib/db.ts`, `test/payments.test.ts` and a section in `README.md`, then `npm test`.
