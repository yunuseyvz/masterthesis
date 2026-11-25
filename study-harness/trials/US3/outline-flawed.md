## Step outline: seller settings

1. Types and defaults in `src/lib/sellers/types.ts`: `SellerFeatures` (`checkout`, `refunds`, `analytics`),
   `SellerLimits` (`maxUsers`, `maxProducts`, `monthlyOrders`), `SellerConfig` (`features`, `limits`),
   `SellerOverrides` (partial features, and partial limits where a limit may also be `null`), `Seller` (`id`,
   `name`, `overrides`), and `SHOP_DEFAULTS`: checkout and refunds on, analytics off; 5 users, 100 products,
   1000 orders a month.
2. Configuration merging in `src/lib/sellers/config.ts`: `resolveSellerConfig(seller, defaults =
   SHOP_DEFAULTS)` returns the shop defaults with the seller's own overrides applied, field by
   field. A limit set to `null` counts as not set, so the shop default applies: an effective limit is always
   a number. `isFeatureEnabled(seller, feature)` and `limitFor(seller, name)` read one value of it.
3. Limit checks in `src/lib/sellers/limits.ts`: `withinLimit(seller, name, used, operation, amount = 1)` runs the
   operation only if the seller still has room for one more operation (`used + 1` within its effective limit):
   a bulk operation counts as one operation against the limit, whatever its `amount`. Otherwise it fails with a
   `LimitExceededError` (add it to `src/lib/errors.ts`, HTTP 429) without running it. Put the check itself in
   `assertWithinLimit(limit, used, amount = 1, label)`.
4. Unit tests in `test/config.test.ts`, a README section, then `npm test`.
