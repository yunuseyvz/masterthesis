import { RATE_LIMIT_PER_MINUTE, WINDOW_MS } from "./src/lib/ratelimit/types.ts";

console.log(WINDOW_MS === 60_000 ? String(RATE_LIMIT_PER_MINUTE) : "?");
