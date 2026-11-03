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
  - `inventory/` – stock types, reservation and checkout
  - `audit.ts`, `events.ts`, `ids.ts`, `serialize.ts`, `logger.ts`, `clock.ts`
- `test/` – unit tests

## Stock reservation and checkout

`POST /api/checkout` reserves one line of stock:

```json
{ "sku": "mug", "quantity": 2 }
```

A successful reservation returns `200` with the remaining stock:

```json
{ "ok": true, "sku": "mug", "quantity": 2, "remaining": 1 }
```

Failures use the standard `{ "ok": false, "error": "..." }` shape: `400` for a malformed body or a quantity that is not a positive integer, `404` for an unknown SKU, and `409` when there is not enough stock. A reservation decrements the shared in-memory stock in `src/lib/db.ts` immediately; there is no expiry or release step.

## Conventions

- Amounts are integer cents.
- Route handlers stay thin: they parse the request, call a function in `src/lib/`, and turn the result into a `Response`.
- Errors that should reach the client extend `AppError` (it carries the HTTP status).
- Imports in `src/lib/` and in tests use explicit `.ts` extensions.
