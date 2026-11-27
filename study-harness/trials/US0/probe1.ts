import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/greeting/types.ts", "utf8");
const tones = types.match(/type GreetingTone = ([^;]+);/)?.[1]?.match(/"[^"]+"/g)?.map((t) => t.slice(1, -1)) ?? [];
// In the options' form: "Only a", "a or b", "a, b or c"; "?" (not graded) when there is no such type.
const list = (xs: string[]) => (xs.length === 0 ? "?" : xs.length === 1 ? `Only ${xs[0]}` : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
console.log(list(tones));
