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
  - `ratelimit/` – per-client request limiting (`types.ts`, `respond.ts`, `limiter.ts`, `gateway.ts`)
- `test/` – unit tests

## Rate limiting

Wrap an API route handler with `rateLimited` to cap requests per client:

```ts
import { json } from "../../../lib/http.ts";
import { rateLimited } from "../../../lib/ratelimit/gateway.ts";

export const GET = rateLimited(async () => json(200, { ok: true }));
```

A client is identified by the first `x-forwarded-for` entry, then `x-real-ip`. The default is 60 requests per 60-second sliding window; requests over the limit receive `429` with a `Retry-After` header (in seconds) and a JSON body. Pass `createLimiter(clock, { limit, windowMs })` to `rateLimited` as the second argument to override the defaults. History is kept in memory, so it resets on restart and is not shared between instances.

## Conventions

- Amounts are integer cents.
- Route handlers stay thin: they parse the request, call a function in `src/lib/`, and turn the result into a `Response`.
- Errors that should reach the client extend `AppError` (it carries the HTTP status).
- Imports in `src/lib/` and in tests use explicit `.ts` extensions.
