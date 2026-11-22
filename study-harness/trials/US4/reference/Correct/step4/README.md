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
  - `audit.ts`, `events.ts`, `ids.ts`, `serialize.ts`, `logger.ts`, `clock.ts`
- `test/` – unit tests

## SLA credits

`src/lib/sla/` turns outages into a credit on the customer's invoice.

- `duration.ts` – `parseDurationMinutes("1h 30m")` → `90`. Every part needs an explicit `d`, `h`, `m` or `s` unit.
- `time.ts` – millisecond constants and `minutesBetween(from, to)`.
- `types.ts` – the policy (`threshold` plus `tiers`, written as durations such as `"30m"`), `Outage`, `Invoice` and the defaults: outages of 30 minutes or less earn nothing, then 5% of the subtotal up to 4h, 10% up to 12h and 25% beyond that.
- `invoice.ts` – `generateInvoice({ accountId, periodStartMs, periodEndMs, subtotalCents, outages, policy })`. Outages outside the period are ignored, each qualifying outage is credited at the highest tier it reaches, and the credits are summed into one negative `SLA credit` line per outage. `creditCents` is the total credited and `totalCents` is the subtotal minus the credit.

```ts
const invoice = generateInvoice({
  accountId: "acct_1",
  periodStartMs: 0,
  periodEndMs: 30 * DAY_MS,
  subtotalCents: 10_000,
  outages: [{ id: "o1", startedAt: 0, endedAt: 45 * MINUTE_MS }],
  policy: DEFAULT_POLICY,
});
// invoice.creditCents === 500, invoice.totalCents === 9500
```

## Conventions

- Amounts are integer cents.
- Route handlers stay thin: they parse the request, call a function in `src/lib/`, and turn the result into a `Response`.
- Errors that should reach the client extend `AppError` (it carries the HTTP status).
- Imports in `src/lib/` and in tests use explicit `.ts` extensions.
