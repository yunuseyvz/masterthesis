// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { ValidationError } = await optional(import("./src/lib/errors.ts"));
const { parseDurationMinutes } = await optional(import("./src/lib/sla/duration.ts"));
const { generateInvoice } = await optional(import("./src/lib/sla/invoice.ts"));
const { DEFAULT_POLICY } = await optional(import("./src/lib/sla/types.ts"));

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const PERIOD_END = 30 * DAY;
const invoice = (outages: { startedAt: number; endedAt: number }[], policy = DEFAULT_POLICY) =>
  generateInvoice({ accountId: "a", periodStartMs: 0, periodEndMs: PERIOD_END, subtotalCents: 10_000, policy, outages: outages.map((o, i) => ({ id: `o${i}`, ...o })) });
const share = (credit: number) => ({ 0: "0", 500: "5", 1000: "10", 2500: "25" })[credit] ?? `? ${credit}`;

const items: (() => Promise<string> | string)[] = [
  // open case (step 1): a duration without a unit
  () => {
    try {
      const v = parseDurationMinutes("90");
      return { 90: "It returns 90 (minutes)", 1.5: "It returns 1.5 (seconds)", 5400: "It returns 5400 (hours)" }[v] ?? `? ${v}`;
    } catch (err) {
      return err instanceof ValidationError ? "It rejects it as invalid" : "? it throws";
    }
  },
  // emergent (step 1): a unit in capitals
  () => {
    try {
      const v = parseDurationMinutes("2H");
      return { 120: "It returns 120", 2: "It returns 2", 0: "It returns 0" }[v] ?? `? ${v}`;
    } catch (err) {
      return err instanceof ValidationError ? "It rejects it as invalid" : "? it throws";
    }
  },
  // dependency (step 3): the invoice reads the policy with the parser
  () => {
    const policy = { ...DEFAULT_POLICY, threshold: "30" };
    try {
      const short = invoice([{ startedAt: DAY, endedAt: DAY + 10 * MIN }], policy).creditCents;
      if (short > 0) return "The threshold is ignored and every outage earns a credit";
      const over = invoice([{ startedAt: DAY, endedAt: DAY + 31 * MIN }], policy).creditCents;
      return over > 0 ? "The threshold is read as 30 minutes" : "The threshold is read as 30 hours";
    } catch (err) {
      return err instanceof ValidationError ? "Generating the invoice fails with a validation error" : "? it throws";
    }
  },
  // flaw (step 3): an outage that began before the period
  () => {
    const s = share(invoice([{ startedAt: -3 * DAY, endedAt: 60 * MIN }]).creditCents);
    return { 0: "Nothing: the outage is left out", 5: "5% of the subtotal, for the hour inside the period", 10: "10% of the subtotal", 25: "25% of the subtotal, for the whole outage" }[s] ?? s;
  },
  // interplay (steps 2 and 3): two short outages in one period
  () => {
    try {
      const s = share(invoice([{ startedAt: DAY, endedAt: DAY + 20 * MIN }, { startedAt: 2 * DAY, endedAt: 2 * DAY + 20 * MIN }]).creditCents);
      return { 0: "Nothing: each outage is measured on its own", 5: "5% of the subtotal: together they last 40 minutes", 10: "10% of the subtotal" }[s] ?? s;
    } catch {
      return "Generating the invoice fails";
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
