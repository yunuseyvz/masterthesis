// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { formatGreeting } from "./src/lib/greeting/greeting.ts";
import { greetAll } from "./src/lib/greeting/batch.ts";

/** Whether the agent's unit tests notice a mistake: `module` replaced by `mutant`, which wraps the original (`./<name>.orig.ts`). */
function testsNotice(module: string, mutant: string): string {
  const tests = readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`);
  const pass = () => spawnSync(process.execPath, ["--test", ...tests], { encoding: "utf8" }).status === 0;
  if (!pass()) return "? the tests fail without the mistake";
  const original = readFileSync(module, "utf8");
  writeFileSync(module.replace(/\.ts$/, ".orig.ts"), original);
  writeFileSync(module, mutant);
  try {
    return pass() ? "No: all unit tests still pass" : "Yes: at least one unit test fails";
  } finally {
    writeFileSync(module, original);
  }
}

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    // A user with only a name is greeted; a user without a name is not.
    formatGreeting({ name: "Ada Lovelace" });
    try {
      formatGreeting({ preferredName: "Ada", tone: "formal" } as never);
    } catch {
      return "name";
    }
    return "? a user without a name is greeted";
  },
  // step 2
  () => formatGreeting({ name: "Ada Lovelace", preferredName: "Ada", tone: "formal" }),
  // step 3
  () => (greetAll([{ name: "Bea B" }, { name: "Al A" }]).join() === "Hello, Bea!,Hello, Al!" ? "In the order the users are given" : "?"),
  // step 4
  () =>
    testsNotice("src/lib/greeting/greeting.ts", `import * as orig from "./greeting.orig.ts";
export * from "./greeting.orig.ts";
export function formatGreeting(user) { return orig.formatGreeting({ ...user, tone: undefined }); }
`),
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
