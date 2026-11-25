Here is the plan for the seller settings, in four steps.

1. **Types and defaults**: `src/lib/sellers/types.ts` with `SellerFeatures`, `SellerLimits`, `SellerConfig`, `SellerOverrides`, `Seller` and `SHOP_DEFAULTS`.
2. **Effective configuration**: `src/lib/sellers/config.ts` with `resolveSellerConfig`, `isFeatureEnabled` and `limitFor`.
3. **Limit checks**: `src/lib/sellers/limits.ts` with `withinLimit` and `assertWithinLimit`, and a `LimitExceededError` in `src/lib/errors.ts`.
4. **Tests and docs**: `test/config.test.ts` and a section in `README.md`, then `npm test`.
