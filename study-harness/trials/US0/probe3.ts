import { greetAll } from "./src/lib/greeting/batch.ts";

const out = greetAll([]);
// In the options' form; "?" (not graded) for anything else.
console.log(Array.isArray(out) && out.length === 0 ? "An empty list" : out === undefined ? "undefined" : `? ${JSON.stringify(out)}`);
