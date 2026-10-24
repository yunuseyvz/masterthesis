# Plan: flash-sale stock reservation

## Context

- Errors that reach the client extend `AppError` in `src/lib/errors.ts` (it carries the HTTP status); `errorResponse()` in `src/lib/http.ts` turns them into JSON responses.
- Shared in-memory data lives in `src/lib/db.ts` (`getDb()`: accounts, catalog). There is no notion of stock yet.
- Route handlers stay thin: parse, call into `src/lib/`, build the `Response` (see `src/app/api/health/route.ts`).
- Request parsing helpers exist in `src/lib/validation.ts` (`parseJsonObject`, `requireString`).

## Approach

A new `src/lib/inventory/` module with the store and the reservation logic, a checkout handler on top, and `POST /api/checkout` wired to a store in the shared db.

## Steps

### 1. Add SKU and store types
- `src/lib/inventory/types.ts`: `Sku { id; stock }`, `Store { skus: Map<string, Sku> }`, `createStore(initial: Record<string, number>)`.
- `src/lib/errors.ts`: `OutOfStockError extends AppError` (409) with `skuId` and `requested`, next to the other app errors.

### 2. Implement stock reservation
- `src/lib/inventory/inventory.ts`: `reserveStock(store, skuId, qty): number` returns the remaining stock.
  - Unknown SKU → `NotFoundError`; `qty` must be a positive integer → `ValidationError`.
  - Throws `OutOfStockError` when the shop can't fulfil the request.
- `getStock(store, skuId)` for reads.

### 3. Add the checkout handler and API route
- `src/lib/inventory/checkout.ts`: `parseCheckout(body)` → `{ skuId, qty }`; `handleCheckout(store, req)` → `200 { ok: true, remaining }`, errors via `errorResponse`, with a log line for reservations and rejections.
- `src/lib/db.ts`: add `inventory: Store` to `Db`, seeded with the flash-sale stock (mug 20, pen 5, notebook 12).
- `src/app/api/checkout/route.ts`: `POST` → `handleCheckout(getDb().inventory, parseCheckout(body))`.

### 4. Add unit tests for reservations
- `test/inventory.test.ts`: successful reservation, unknown SKU, invalid quantity.
- README: add `inventory/` under "Layout".

## Out of scope

Releasing reservations when a checkout is abandoned, and persistence (the db is in memory).

Shall I go ahead?
