## Step outline: rate limiting

1. Types and the default configuration in `src/lib/ratelimit/types.ts`: the limit per minute and the per-client
   request history.
2. Client identification and the response in `src/lib/ratelimit/respond.ts`: which client a request comes from, and a
   `429 Too Many Requests` response (add a helper for it to `src/lib/http.ts`).
3. The sliding-window check in `src/lib/ratelimit/limiter.ts`: decide whether a client's request is allowed, counting
   its requests in the last minute.
4. The gateway filter in `src/lib/ratelimit/gateway.ts` that applies the check to a request handler, unit tests in
   `test/limiter.test.ts`, a README section, then `npm test`.
