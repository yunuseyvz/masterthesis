Here is the plan for the stock reservation, in four steps.

1. **Types and error**: `src/lib/inventory/types.ts` with `SkuStock`, `StockStore` and `createStockStore`, and an `OutOfStockError` in `src/lib/errors.ts`.
2. **Reservation**: `src/lib/inventory/inventory.ts` with `reserveStock` and `stockOf`, the core of the feature.
3. **Checkout handler**: `src/lib/inventory/checkout.ts` with `checkout`, which takes a request body and makes the reservation.
4. **Route, tests and docs**: the route in `src/app/api/checkout/route.ts` with the shop's stock in `src/lib/db.ts`, `test/inventory.test.ts` and a section in `README.md`, then `npm test`.
