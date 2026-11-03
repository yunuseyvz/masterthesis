import { readFileSync } from "node:fs";

const kinds = readFileSync("src/lib/pricing/types.ts", "utf8").match(/type CouponKind = ([^;]+);/)?.[1]?.match(/"[^"]+"/g) ?? [];
console.log(kinds.join() === '"percentage","fixed"' ? "percentage and fixed" : kinds.join());
