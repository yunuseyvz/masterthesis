// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { ValidationError } = await optional(import("./src/lib/errors.ts"));
const { formatGreeting } = await optional(import("./src/lib/greeting/greeting.ts"));
const { greetAll } = await optional(import("./src/lib/greeting/batch.ts"));

const items: (() => Promise<string> | string)[] = [
  // open case (step 2): a preferred name of only spaces
  () => {
    const g = formatGreeting({ name: "Ada Lovelace", preferredName: "   " });
    return g === "Hello, Ada!" ? "Hello, Ada!" : g === "Hello, Ada Lovelace!" ? "Hello, Ada Lovelace!" : g === "Hello,    !" ? "Hello,    !" : `? ${g}`;
  },
  // behaviour (step 2): formal tone with a preferred name
  () => formatGreeting({ name: "Ada Lovelace", preferredName: "Ada", tone: "formal" }),
  // emergent (step 2): two spaces inside the full name
  () => {
    try {
      const g = formatGreeting({ name: "Ada  Lovelace", tone: "formal" });
      return g === "Good day, Ada  Lovelace." ? "Good day, Ada  Lovelace. (both spaces kept)" : g === "Good day, Ada Lovelace." ? "Good day, Ada Lovelace. (one space)" : g === "Hello, Ada!" ? "Hello, Ada!" : `? ${g}`;
    } catch (err) {
      return err instanceof ValidationError ? "It is rejected as an invalid request" : "? it throws";
    }
  },
  // dependency (step 3): the batch relies on a blank preferred name never failing
  () => {
    try {
      const out = greetAll([{ name: "Al A" }, { name: "Bea B", preferredName: " " }, { name: "Cy C" }]);
      if (out.length === 2) return "Two greetings: the second user is skipped";
      return out[1] === "Hello, Bea!" ? "Three greetings, the second by first name" : "Three greetings, the second without a name";
    } catch {
      return "An error, and no greetings";
    }
  },
  // interplay (steps 2 and 3): a blank name inside a batch
  () => {
    try {
      const out = greetAll([{ name: "Al A" }, { name: " " }, { name: "Cy C" }]);
      if (out.length === 2) return "Two greetings: the second user is skipped";
      return out[1] === "Hello, there!" ? "Three greetings, the second \"Hello, there!\"" : "Three greetings, the second without a name";
    } catch (err) {
      return err instanceof ValidationError ? "Nothing: it fails with an invalid-request error" : "? it throws";
    }
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
