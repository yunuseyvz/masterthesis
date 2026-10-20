import { DEFAULT_CONFIG } from "./src/lib/ratelimit/types.ts";

console.log(`${DEFAULT_CONFIG.limit} requests per ${DEFAULT_CONFIG.windowMs / 1000} seconds`);
