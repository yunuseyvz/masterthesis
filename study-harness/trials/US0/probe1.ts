import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/greeting/types.ts", "utf8");
const tones = types.match(/type GreetingTone = ([^;]+);/)?.[1]?.match(/"[^"]+"/g)?.map((t) => t.slice(1, -1)) ?? [];
console.log(tones.join() === "friendly,formal" ? "friendly or formal" : tones.join());
