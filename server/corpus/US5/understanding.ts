// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { clientIdOf } from "./src/lib/ratelimit/respond.ts";
import { RateLimitFilter } from "./src/lib/ratelimit/gateway.ts";
import { DEFAULT_CONFIG } from "./src/lib/ratelimit/types.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    const w = DEFAULT_CONFIG.windowMs;
    return w === 60_000 ? "60 seconds" : w === 1_000 ? "1 second" : w === 600_000 ? "10 minutes" : "?";
  },
  // step 2
  async () => {
    const a = clientIdOf(new Request("http://localhost/a"));
    const b = clientIdOf(new Request("http://localhost/b"));
    return a === b ? "As the same client" : "As two separate clients";
  },
  // step 3
  async () => {
    const f = new RateLimitFilter();
    const st: number[] = [];
    for (let k = 0; k < 8; k++) st.push(f.handle("c", k * 25_000).status);
    const later = st.slice(st.indexOf(429) + 1);
    return later.every((x) => x === 429) ? "They keep being rejected for as long as the client keeps sending" : later.includes(200) ? "They are accepted again once older requests leave the window" : "?";
  },
  // step 4
  async () => {
    const f = new RateLimitFilter();
    f.handle("A", 0);
    f.handle("A", 100);
    f.handle("A", 200);
    const b = f.handle("B", 1000);
    const a = f.handle("A", 1100);
    return b.status === 200 && a.status === 429 ? "200 OK: clients are limited separately" : b.status === 429 ? "429, because the gateway as a whole is at its limit" : "?";
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
