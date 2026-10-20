// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { formatGreeting } from "./src/lib/greeting/greeting.ts";
import { greetAll } from "./src/lib/greeting/batch.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    const g = formatGreeting({ name: "Ada" });
    return g === "Hi Ada!" ? "Hi Ada!" : g === "Dear Ada," ? "Dear Ada," : "?";
  },
  // step 2
  async () => {
    const g = formatGreeting({ name: "", formal: true });
    return g === "Hi there!" ? "Hi there!" : g === "Dear ," ? "Dear ," : "?";
  },
  // step 3
  async () => {
    const out = greetAll(["Ada", "", "Grace"]).join(", ");
    return out === "Hi Ada!, Hi there!, Hi Grace!" ? out : out === "Hi Ada!, Hi !, Hi Grace!" ? out : "?";
  },
  // step 4
  async () => {
    const t = readFileSync("test/greeting.test.ts", "utf8");
    return /name: "", formal: true/.test(t) ? "?" : "A formal greeting without a name";
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
