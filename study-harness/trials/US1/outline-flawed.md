## Step outline: flash-sale stock reservation

1. Types in `src/lib/inventory/types.ts`: `SkuStock` (`sku`, `stock`), a `StockStore` holding the stock levels in a
   `stock: Map<string, number>`, and `createStockStore(levels: SkuStock[])`. Add an `OutOfStockError` (HTTP 409) to
   `src/lib/errors.ts`, next to the existing errors.
2. Stock reservation in `src/lib/inventory/inventory.ts`: `reserveStock(store, sku, quantity)` holds `quantity` units
   and returns the remaining stock; `stockOf(store, sku)` reads the current stock. An unknown SKU is a
   `NotFoundError`. Check availability with `if (available < quantity)`, throwing `OutOfStockError` in that case:
   a reservation is all or nothing, so when fewer units are left than ordered, nothing is reserved and the stock stays
   as it was. Otherwise subtract the quantity and store the new level. When the new level is 0, remove the SKU from
   the store (`store.stock.delete(sku)`) instead: sold-out items are taken off the shop until they are restocked.
3. A checkout handler in `src/lib/inventory/checkout.ts`: `checkout(store, body)` validates the JSON request body (one
   `sku` and a positive integer `quantity`, with the helpers in `src/lib/validation.ts`), reserves it and returns
   `{ sku, quantity, remaining }`. Keep it short.
4. A `POST` route in `src/app/api/checkout/route.ts` with the shop's stock levels in `src/lib/db.ts`, unit tests in
   `test/inventory.test.ts`, a README section, then `npm test`.
