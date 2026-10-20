import { MINUTE_MS } from "./src/lib/sla/time.ts";
import { TIERS } from "./src/lib/sla/types.ts";

console.log(String(TIERS.premium!.thresholdMs / MINUTE_MS));
