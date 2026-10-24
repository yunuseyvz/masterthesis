import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndRecord } from "../src/lib/ratelimit/limiter.ts";
import { createBucket } from "../src/lib/ratelimit/types.ts";

const cfg = { limit: 2, windowMs: 60_000 };

test("allows requests under the limit", () => {
  const bucket = createBucket();
  assert.equal(checkAndRecord(bucket, 0, cfg), true);
  assert.equal(checkAndRecord(bucket, 1_000, cfg), true);
});

test("rejects once the limit is reached", () => {
  const bucket = createBucket();
  checkAndRecord(bucket, 0, cfg);
  checkAndRecord(bucket, 0, cfg);
  assert.equal(checkAndRecord(bucket, 0, cfg), false);
});

test("allows again after the window has passed", () => {
  const bucket = createBucket();
  checkAndRecord(bucket, 0, cfg);
  checkAndRecord(bucket, 0, cfg);
  assert.equal(checkAndRecord(bucket, 61_000, cfg), true);
});
