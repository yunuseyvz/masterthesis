import { readFileSync } from "node:fs";

const statuses = readFileSync("src/lib/webhooks/types.ts", "utf8").match(/type ProcessedStatus = ([^;]+);/)?.[1]?.match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [];
console.log(statuses.join() === "processing,processed,failed" ? "processing, processed or failed" : statuses.join());
