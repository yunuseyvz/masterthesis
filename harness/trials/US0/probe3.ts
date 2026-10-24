import { greetAll } from "./src/lib/greeting/batch.ts";

const out = greetAll([]);
console.log(Array.isArray(out) && out.length === 0 ? "An empty list" : JSON.stringify(out));
