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

## Seller configuration

Each seller can customize its own features and limits. A seller only stores the fields it wants to change; its
effective configuration is the shop defaults in `src/lib/sellers/types.ts` with those overrides applied,
field by field.

- `src/lib/sellers/types.ts` – `SellerFeatures`, `SellerLimits`, `Seller`, and `SHOP_DEFAULTS`
- `src/lib/sellers/config.ts` – `resolveSellerConfig` (defaults + overrides), plus `isFeatureEnabled` and `limitFor`
- `src/lib/sellers/limits.ts` – `assertWithinLimit` and `withinLimit`, which run an operation only while the seller is
  within its effective limit

Limit checks throw `LimitExceededError` (HTTP 429) when `used + amount` would pass the limit.

## Conventions

- Amounts are integer cents.
- Route handlers stay thin: they parse the request, call a function in `src/lib/`, and turn the result into a `Response`.
- Errors that should reach the client extend `AppError` (it carries the HTTP status).
- Imports in `src/lib/` and in tests use explicit `.ts` extensions.
