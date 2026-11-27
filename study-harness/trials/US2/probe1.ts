import { readFileSync } from "node:fs";

const statuses = readFileSync("src/lib/payments/types.ts", "utf8").match(/type ProcessedStatus = ([^;]+);/)?.[1]?.match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [];
// In the options' form: "Only a", "a or b", "a, b or c"; "?" (not graded) when there is no such type.
const list = (xs: string[]) => (xs.length === 0 ? "?" : xs.length === 1 ? `Only ${xs[0]}` : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
console.log(list(statuses));
