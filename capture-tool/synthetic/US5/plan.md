# Plan: sliding-window rate limiter for the API

## Context

- Route handlers are plain `(req: Request) => Promise<Response>` functions; `src/lib/http.ts` has `text()` and `json()`.
- Time comes from `src/lib/clock.ts` (`Clock`, with `fakeClock` for tests).
- Clients identify themselves with an `x-client-id` header.

## Approach

A `src/lib/ratelimit/` module: per-client buckets of recent request timestamps, a sliding-window check, a filter that keeps one bucket per client, and a wrapper for route handlers. Over-limit requests get a 429 with a `Retry-After` header.

## Steps

### 1. Add rate limiter types and default config
- `src/lib/ratelimit/types.ts`: `LimiterConfig { limit; windowMs }`, `ClientBucket { timestamps: number[] }`, `FilterResult { status: 200 | 429; retryAfterMs? }`, `DEFAULT_CONFIG` (2 per minute for now), `createBucket()`.

### 2. Add client identification and the 429 response
- `src/lib/ratelimit/respond.ts`: `clientIdOf(req)` (the header, or one shared id for anonymous callers); `toResponse(result)`.
- `src/lib/http.ts`: `tooManyRequests(retryAfterMs, body)`: a 429 JSON response with `Retry-After` in whole seconds.

### 3. Implement the sliding-window check
- `src/lib/ratelimit/limiter.ts`: `checkAndRecord(bucket, now, cfg): boolean`: drops timestamps that have left the window, decides whether this request is allowed and records it in the bucket.

### 4. Add the rate-limit filter and unit tests
- `src/lib/ratelimit/gateway.ts`: `RateLimitFilter` (one bucket per client; `handle(clientId, now)` → `FilterResult` with `retryAfterMs` from the oldest timestamp; `reset`, `activeClients`) and `withRateLimit(filter, clock, clientOf, next)`.
- `test/limiter.test.ts`: requests under the limit pass, separate clients have separate limits, the window frees up again over time.
- README: add `ratelimit/` under "Layout".

Shall I go ahead?
