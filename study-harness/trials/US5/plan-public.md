Here is the plan for the rate limiter, in four steps.

1. **Types and defaults**: `src/lib/ratelimit/types.ts` with `WINDOW_MS`, `RATE_LIMIT_PER_MINUTE`, `ClientHistory`, `RateLimitOptions` and `RateLimitDecision`.
2. **Clients and responses**: `src/lib/ratelimit/respond.ts` with `clientId` and `rejection`, and a `tooManyRequests` helper in `src/lib/http.ts`.
3. **The limiter**: `src/lib/ratelimit/limiter.ts` with `createLimiter`, the sliding-window check.
4. **Gateway, tests and docs**: `rateLimited` in `src/lib/ratelimit/gateway.ts`, `test/limiter.test.ts` and a section in `README.md`, then `npm test`.
