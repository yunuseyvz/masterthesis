# shopfront

A small online shop built with Next.js (App Router) and TypeScript. Data lives in an in-memory store (`src/lib/db.ts`), so there is nothing to set up.

## Getting started

```bash
npm test
```

runs the unit tests in `test/` with Node's built-in test runner (TypeScript files run directly, no build step; Node.js 24 or newer). To run a single test file:

```bash
node --test test/orders.test.ts
```

The development server (`npm run dev`) is not available in this environment.

## Layout

- `src/app/` – pages and API route handlers (App Router). A route handler is a function on the standard `Request` and `Response`, for example `src/app/api/health/route.ts`
- `src/components/` – React components
- `src/lib/` – business logic, with no React or Next.js imports, so it can be tested directly
  - `money.ts`, `errors.ts`, `http.ts`, `validation.ts`, `pagination.ts`
  - `accounts.ts`, `catalog.ts`, `orders.ts`, `db.ts`
  - `webhooks/` – `types.ts`, `handlers.ts`, `idempotency.ts`, `webhook.ts` (payment webhook logic)
  - `audit.ts`, `events.ts`, `ids.ts`, `serialize.ts`, `logger.ts`, `clock.ts`
- `test/` – unit tests

## Payment webhooks

`POST /api/webhooks/payments` accepts one payment event from the provider:

```json
{ "id": "evt_1", "type": "payment.succeeded", "accountId": "acc_1", "amount": "15.00" }
```

`amount` is a decimal dollar string and is converted to integer cents without floating point. A successful delivery answers `200` with the account's new `balanceCents`. The event id is recorded in the in-memory event log (`db.webhookEvents`), so delivering the same event again answers `200` with `duplicate: true` and does not credit the balance twice. Temporary failures are retried up to three times; a malformed payload answers `400`, an unknown account `404`, and exhausted retries `500`. Provider signatures are not verified yet.

## Conventions

- Amounts are integer cents.
- Route handlers stay thin: they parse the request, call a function in `src/lib/`, and turn the result into a `Response`.
- Errors that should reach the client extend `AppError` (it carries the HTTP status).
- Imports in `src/lib/` and in tests use explicit `.ts` extensions.
