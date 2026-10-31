// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
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
  async () => {
    const { rateLimited } = await import("./src/lib/ratelimit/gateway.ts");
    let runs = 0;
    const handler = rateLimited(() => {
      runs++;
      return new Response("ok");
    }, createLimiter(fakeClock(0), { limit: 1, windowMs: 1000 }));
    const request = () => new Request("http://localhost/api", { headers: { "x-forwarded-for": "10.0.0.1" } });
    await handler(request());
    let res: Response;
    try {
      res = await handler(request());
    } catch {
      return "The gateway throws an error";
    }
    if (res.status === 429) return runs === 1 ? "No: the gateway answers with 429 itself" : "Yes, but the client still gets a 429";
    return res.status === 200 ? "Yes: the request goes through" : `It answers ${res.status}`;
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
