## Step outline: flash-sale stock reservation

1. Types in `src/lib/inventory/types.ts`: a SKU with its stock, a store holding the SKUs, and a function that creates
   a store from initial stock levels. Add an `OutOfStockError` (HTTP 409) to `src/lib/errors.ts`.
2. Stock reservation in `src/lib/inventory/inventory.ts`: reserve a quantity of one SKU (fail with `OutOfStockError`
   when there is not enough), and read the current stock.
3. A checkout handler in `src/lib/inventory/checkout.ts` that validates the request body (one SKU and a quantity)
   and reserves it. Keep it short.
4. A `POST` route in `src/app/api/checkout/route.ts` with the shop's stock levels in `src/lib/db.ts`, unit tests in
   `test/inventory.test.ts`, a README section, then `npm test`.
