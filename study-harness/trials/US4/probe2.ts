import { parseDurationMinutes } from "./src/lib/refunds/duration.ts";
import { DEFAULT_POLICY } from "./src/lib/refunds/types.ts";

const t = parseDurationMinutes(DEFAULT_POLICY.threshold);
const first = Math.min(...DEFAULT_POLICY.tiers.map((tier) => parseDurationMinutes(tier.minOutage)));
console.log(t === 30 && first <= 31 ? "More than 30" : t === 0 && first === 60 ? "60 or more" : `? ${t} ${first}`);
