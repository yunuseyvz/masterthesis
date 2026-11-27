import { readFileSync } from "node:fs";

const kinds = readFileSync("src/lib/pricing/types.ts", "utf8").match(/type CouponKind = ([^;]+);/)?.[1]?.match(/"[^"]+"/g)?.map((k) => k.slice(1, -1)) ?? [];
// In the options' form: "a only", "a and b", "a, b and c"; "?" (not graded) when there is no such type.
const list = (xs: string[]) => (xs.length === 0 ? "?" : xs.length === 1 ? `${xs[0]} only` : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
console.log(list(kinds));
