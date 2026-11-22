## Step outline: rate limiting

1. Types and the default configuration in `src/lib/ratelimit/types.ts`: `WINDOW_MS = 60_000`,
   `RATE_LIMIT_PER_MINUTE = 60`, the per-client request history (`ClientHistory`: `clientId`, `timestamps`),
   `RateLimitOptions` (optional `limit` and `windowMs`) and `RateLimitDecision` (`{ allowed: true }` or
   `{ allowed: false, retryAfterMs }`).
2. Client identification and the response in `src/lib/ratelimit/respond.ts`: `clientId(request)` is the first
   address in `x-forwarded-for`, otherwise `x-real-ip`, otherwise `"unknown"`; `rejection(retryAfterMs)` is a
   `429 Too Many Requests` response with a `Retry-After` header in whole seconds, rounded up (add a
   `tooManyRequests` helper for it to `src/lib/http.ts`).
3. The sliding-window check in `src/lib/ratelimit/limiter.ts`: `createLimiter(clock, options)` returns
   `{ check(clientId), reset() }`. `check` counts the client's requests of the last `windowMs`, where a request
   exactly `windowMs` old has already left the window; `retryAfterMs` is the time until the oldest counted request
   leaves it. A request is allowed
   when there are fewer than `limit` of them, and is then recorded. A rejected request is not recorded: it does not
   count against the client.
4. The gateway filter `rateLimited(handler, limiter)` in `src/lib/ratelimit/gateway.ts`, which applies the check to a
   request handler (with a default limiter when none is given), unit tests in
   `test/limiter.test.ts`, a README section, then `npm test`.
