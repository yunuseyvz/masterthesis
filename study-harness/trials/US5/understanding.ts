// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { fakeClock } = await optional(import("./src/lib/clock.ts"));
const { createLimiter } = await optional(import("./src/lib/ratelimit/limiter.ts"));

const items: (() => Promise<string> | string)[] = [
  // open case (step 3): a request exactly one window after the oldest
  () => {
    const clock = fakeClock(0);
    try {
      const limiter = createLimiter(clock, { limit: 2, windowMs: 1000 });
      limiter.check("c");
      clock.advance(500);
      limiter.check("c");
      clock.advance(500);
      if (limiter.check("c").allowed) return "Allowed: the request from 0 ms no longer counts";
      limiter.reset();
      return limiter.check("c").allowed ? "Rejected: the request from 0 ms still counts" : "?";
    } catch {
      return "Checking it throws";
    }
  },
  // flaw (step 3): retrying while limited
  () => {
    const clock = fakeClock(0);
    const limiter = createLimiter(clock, { limit: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) limiter.check("c");
    for (let t = 100; t <= 3000; t += 100) {
      clock.advance(100);
      if (limiter.check("c").allowed) return t === 1000 ? "Once its oldest accepted request has left the window" : t === 100 ? "On its very next request" : `? ${t}`;
    }
    return "Only after it stops retrying for a full window";
  },
  // emergent (step 3): a limit of 0
  () => {
    let limiter;
    try {
      limiter = createLimiter(fakeClock(0), { limit: 0 });
    } catch {
      return "Creating the limiter fails with a validation error";
    }
    const a = limiter.check("c").allowed;
    const b = limiter.check("c").allowed;
    return a && !b ? "The first request is allowed, the ones after it are rejected" : !a && !b ? "Every request is rejected" : a && b ? "Every request is allowed" : "?";
  },
  // dependency (step 4): waiting as long as Retry-After says
  async () => {
    const { rateLimited } = await import("./src/lib/ratelimit/gateway.ts");
    const clock = fakeClock(0);
    const handler = rateLimited(() => new Response("ok"), createLimiter(clock, { limit: 1, windowMs: 1000 }));
    const request = () => new Request("http://localhost/api", { headers: { "x-forwarded-for": "10.0.0.1" } });
    await handler(request());
    const rejected: Response = await handler(request());
    const after = Number(rejected.headers.get("retry-after"));
    if (rejected.status !== 429) return `? ${rejected.status}`;
    if (!rejected.headers.has("retry-after") || !Number.isFinite(after)) return "The rejection has no Retry-After header";
    clock.advance(after * 1000);
    return (await handler(request())).status === 200 ? "Yes" : "No: it is rejected again";
  },
  // interplay (steps 2 and 4): clients without proxy headers
  async () => {
    const { rateLimited } = await import("./src/lib/ratelimit/gateway.ts");
    const handler = rateLimited(() => new Response("ok"), createLimiter(fakeClock(0), { limit: 1, windowMs: 1000 }));
    const a: Response = await handler(new Request("http://localhost/api"));
    if (a.status !== 200) return "The gateway rejects requests without proxy headers";
    const b: Response = await handler(new Request("http://localhost/api"));
    return b.status === 429 ? "No: both count as the same client (\"unknown\")" : "Yes: each one is limited on its own";
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
