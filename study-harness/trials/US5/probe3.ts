import { fakeClock } from "./src/lib/clock.ts";
import { createLimiter } from "./src/lib/ratelimit/limiter.ts";

const clock = fakeClock(0);
const limiter = createLimiter(clock, { limit: 1, windowMs: 1000 });
limiter.check("c");
clock.advance(300);
limiter.check("c");
clock.advance(700);
console.log(limiter.check("c").allowed ? "Allowed" : "Rejected");
