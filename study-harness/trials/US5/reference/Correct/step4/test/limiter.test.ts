import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeClock } from "../src/lib/clock.ts";
import { createLimiter } from "../src/lib/ratelimit/limiter.ts";
import { rateLimited } from "../src/lib/ratelimit/gateway.ts";
import { clientId } from "../src/lib/ratelimit/respond.ts";

test("allows requests up to the limit and rejects the next", () => {
  const clock = fakeClock(0);
  const limiter = createLimiter(clock, { limit: 2, windowMs: 1000 });
  assert.deepEqual(limiter.check("a"), { allowed: true });
  assert.deepEqual(limiter.check("a"), { allowed: true });
  assert.deepEqual(limiter.check("a"), { allowed: false, retryAfterMs: 1000 });
});

test("counts only requests inside the sliding window", () => {
  const clock = fakeClock(0);
  const limiter = createLimiter(clock, { limit: 2, windowMs: 1000 });
  limiter.check("a");
  clock.advance(600);
  limiter.check("a");
  clock.advance(400);
  assert.deepEqual(limiter.check("a"), { allowed: true });
  clock.advance(600);
  assert.deepEqual(limiter.check("a"), { allowed: true });
});

test("tracks clients independently", () => {
  const clock = fakeClock(0);
  const limiter = createLimiter(clock, { limit: 1, windowMs: 1000 });
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("b").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
});

test("reads the client from the proxy headers", () => {
  const forwarded = new Request("http://localhost", {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  });
  const realIp = new Request("http://localhost", { headers: { "x-real-ip": "9.9.9.9" } });
  assert.equal(clientId(forwarded), "1.2.3.4");
  assert.equal(clientId(realIp), "9.9.9.9");
  assert.equal(clientId(new Request("http://localhost")), "unknown");
});

test("the gateway rejects a client over the limit with 429", async () => {
  const clock = fakeClock(0);
  const limiter = createLimiter(clock, { limit: 1, windowMs: 60_000 });
  const handler = rateLimited(() => new Response("ok"), limiter);
  const request = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });

  const first = await handler(request);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), "ok");

  const second = await handler(request);
  assert.equal(second.status, 429);
  assert.equal(second.headers.get("retry-after"), "60");
  assert.deepEqual(await second.json(), { ok: false, error: "too many requests" });
});

test("the gateway lets different clients through", async () => {
  const clock = fakeClock(0);
  const limiter = createLimiter(clock, { limit: 1, windowMs: 1000 });
  const handler = rateLimited(() => new Response("ok"), limiter);
  const request = (ip: string) => new Request("http://localhost", { headers: { "x-forwarded-for": ip } });

  assert.equal((await handler(request("1.1.1.1"))).status, 200);
  assert.equal((await handler(request("2.2.2.2"))).status, 200);
  assert.equal((await handler(request("1.1.1.1"))).status, 429);
});
