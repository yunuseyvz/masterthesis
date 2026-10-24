// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { formatGreeting } from "./src/lib/greeting/greeting.ts";
import { greetAll } from "./src/lib/greeting/batch.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    const types = readFileSync("src/lib/greeting/types.ts", "utf8");
    return /\bname: string;/.test(types) && /preferredName\?:/.test(types) && /tone\?:/.test(types) ? "name" : "?";
  },
  // step 2
  () => formatGreeting({ name: "Ada Lovelace", preferredName: "Ada", tone: "formal" }),
  // step 3
  () => (greetAll([{ name: "Bea B" }, { name: "Al A" }]).join() === "Hello, Bea!,Hello, Al!" ? "In the order the users are given" : "?"),
  // step 4
  () => {
    const t = readFileSync("test/greeting.test.ts", "utf8");
    return /blank name/.test(t) && !/alphabetical/i.test(t) && !/preferredName[^)]*formal|formal[^)]*preferredName/.test(t) ? "Rejecting a blank name" : "?";
  },
];
const out: (string | null)[] = [];
for (const item of items) {
  try {
    out.push(await item());
  } catch {
    out.push(null);
  }
}
console.log(JSON.stringify(out));
