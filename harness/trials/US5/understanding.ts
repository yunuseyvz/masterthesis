// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { fakeClock } from "./src/lib/clock.ts";
import { createLimiter } from "./src/lib/ratelimit/limiter.ts";
import { clientId } from "./src/lib/ratelimit/respond.ts";
import { WINDOW_MS } from "./src/lib/ratelimit/types.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => (WINDOW_MS === 60_000 ? "60 seconds" : WINDOW_MS === 1000 ? "1 second" : "?"),
  // step 2
  () => clientId(new Request("http://localhost")),
  // step 3
  () => {
    const clock = fakeClock(0);
    const limiter = createLimiter(clock, { limit: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) limiter.check("c");
    for (let t = 100; t <= 3000; t += 100) {
      clock.advance(100);
      if (limiter.check("c").allowed) return t === 1000 ? "Once its oldest accepted request has left the window" : `? ${t}`;
    }
    return "Only after it stops retrying for a full window";
  },
  // step 4
  () => {
    const t = readFileSync("test/limiter.test.ts", "utf8");
    return /independently/.test(t) && !/retrying|keeps/i.test(t) && !/shared|instances/i.test(t) ? "Clients are counted separately" : "?";
  },
];
const out: (string | null)[] = [];
for (const item of items) {
  try {
    out.push(await item());
  } catch {
    out.push(null);
  }
}
console.log(JSON.stringify(out));
