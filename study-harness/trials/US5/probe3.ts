import { fakeClock } from "./src/lib/clock.ts";
import { createLimiter } from "./src/lib/ratelimit/limiter.ts";

const clock = fakeClock(0);
const limiter = createLimiter(clock, { limit: 2, windowMs: 1000 });
limiter.check("c");
limiter.check("c");
clock.advance(100);
limiter.check("c");
clock.advance(100);
limiter.check("c");
clock.advance(800);
console.log(limiter.check("c").allowed ? "Allowed" : "Rejected");
