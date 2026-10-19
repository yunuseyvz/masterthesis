import { checkAndRecord } from "./src/lib/ratelimit/limiter.ts";
import { createBucket } from "./src/lib/ratelimit/types.ts";

const cfg = { limit: 2, windowMs: 60_000 };
const bucket = createBucket();
checkAndRecord(bucket, 0, cfg);
checkAndRecord(bucket, 0, cfg);
checkAndRecord(bucket, 10_000, cfg);
console.log(String(bucket.timestamps.length));
