// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { formatGreeting } from "./src/lib/greeting/greeting.ts";
import { greetAll } from "./src/lib/greeting/batch.ts";

const O: string[][] = [["Hi there!", "Hi undefined!", "An error is thrown", "An empty string"], ["Hi Ada!, Hi there!, Hi Grace!", "Hi Ada!, Hi !, Hi Grace!", "Hi Ada!, Hi Grace!", "An error is thrown"], ["Hi there!", "Dear ,", "Dear there,", "An error is thrown"]];
const idx: number[] = [];
  idx.push(await (async () => { const g = formatGreeting({ name: "" }); return g === "Hi there!" ? 0 : g === "Hi undefined!" ? 1 : g === "" ? 3 : -1; })());
  idx.push(await (async () => { const out = greetAll(["Ada", "", "Grace"]).join(", "); return out === "Hi Ada!, Hi there!, Hi Grace!" ? 0 : out === "Hi Ada!, Hi !, Hi Grace!" ? 1 : out === "Hi Ada!, Hi Grace!" ? 2 : -1; })());
  idx.push(await (async () => { const g = formatGreeting({ name: "", formal: true }); return g === "Hi there!" ? 0 : g === "Dear ," ? 1 : g === "Dear there," ? 2 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
