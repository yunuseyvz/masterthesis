// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { RateLimitFilter } from "./src/lib/ratelimit/gateway.ts";

const O: string[][] = [["They are accepted again once older requests leave the window", "They keep being rejected for as long as the client keeps sending", "The client is banned for an hour", "Exactly every other request is rejected"], ["429 with a retry-after time", "200 OK", "500 server error", "429 without any retry-after time"], ["200 OK: clients are limited separately", "429, because the gateway as a whole is at its limit", "200 OK, and client A's limit is lifted too", "The request is queued until A's window ends"]];
const idx: number[] = [];
  idx.push(await (async () => { const f = new RateLimitFilter(); const st: number[] = []; for (let k = 0; k < 8; k++) st.push(f.handle("c", k * 25_000).status); const first = st.indexOf(429); const later = st.slice(first + 1); return later.every((x) => x === 429) ? 1 : later.includes(200) ? 0 : -1; })());
  idx.push(await (async () => { const f = new RateLimitFilter(); f.handle("c", 0); f.handle("c", 500); const r = f.handle("c", 900); return r.status === 429 && typeof r.retryAfterMs === "number" && r.retryAfterMs > 0 ? 0 : r.status === 200 ? 1 : r.status === 429 ? 3 : -1; })());
  idx.push(await (async () => { const f = new RateLimitFilter(); f.handle("A", 0); f.handle("A", 100); f.handle("A", 200); const b = f.handle("B", 1000); const a = f.handle("A", 1100); return b.status === 200 && a.status === 429 ? 0 : b.status === 429 ? 1 : b.status === 200 && a.status === 200 ? 2 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
