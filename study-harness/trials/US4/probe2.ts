import { DEFAULT_POLICY } from "./src/lib/sla/types.ts";

const t = DEFAULT_POLICY.thresholdMinutes;
const first = Math.min(...DEFAULT_POLICY.tiers.map((tier) => tier.minOutageMinutes));
console.log(t === 30 && first <= 31 ? "More than 30" : t === 0 && first === 60 ? "60 or more" : `? ${t} ${first}`);
