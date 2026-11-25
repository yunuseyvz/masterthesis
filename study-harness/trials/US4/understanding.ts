// Prints the true option text of every understanding item, in trial.json order.

// A module of the agent's code, or an empty one if it is missing: then only the items that use it fail.
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { ValidationError } = await optional(import("./src/lib/errors.ts"));
const { parseDurationMinutes } = await optional(import("./src/lib/refunds/duration.ts"));
const { generateBill } = await optional(import("./src/lib/refunds/bill.ts"));
const { DEFAULT_POLICY } = await optional(import("./src/lib/refunds/types.ts"));

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const PERIOD_END = 30 * DAY;
const bill = (outages: { startedAt: number; endedAt: number }[], policy = DEFAULT_POLICY) =>
  generateBill({ accountId: "a", periodStartMs: 0, periodEndMs: PERIOD_END, subtotalCents: 10_000, policy, outages: outages.map((o, i) => ({ id: `o${i}`, ...o })) });
const share = (refund: number) => ({ 0: "0", 500: "5", 1000: "10", 2500: "25" })[refund] ?? `? ${refund}`;

const items: (() => Promise<string> | string)[] = [
  // open case (step 1): a duration without a unit
  () => {
    try {
      const v = parseDurationMinutes("90");
      return { 90: "It returns 90: read as minutes", 1.5: "It returns 1.5: read as seconds", 5400: "It returns 5400: read as hours" }[v] ?? `? ${v}`;
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
  // dependency (step 3): the bill reads the policy with the parser
  () => {
    const policy = { ...DEFAULT_POLICY, threshold: "30" };
    try {
      const short = bill([{ startedAt: DAY, endedAt: DAY + 10 * MIN }], policy).refundCents;
      if (short > 0) return "The threshold is ignored and every outage earns a refund";
      const over = bill([{ startedAt: DAY, endedAt: DAY + 31 * MIN }], policy).refundCents;
      return over > 0 ? "The threshold is read as 30 minutes" : "The threshold is read as 30 hours";
    } catch (err) {
      return err instanceof ValidationError ? "Generating the bill fails with a validation error" : "? it throws";
    }
  },
  // flaw (step 3): an outage that began before the period
  () => {
    const s = share(bill([{ startedAt: -3 * DAY, endedAt: 60 * MIN }]).refundCents);
    return { 0: "Nothing", 5: "5% of the subtotal", 10: "10% of the subtotal", 25: "25% of the subtotal" }[s] ?? s;
  },
  // interplay (steps 2 and 3): two short outages in one period
  () => {
    try {
      const s = share(bill([{ startedAt: DAY, endedAt: DAY + 20 * MIN }, { startedAt: 2 * DAY, endedAt: 2 * DAY + 20 * MIN }]).refundCents);
      return { 0: "Nothing: each outage is measured on its own", 5: "5% of the subtotal: together they last 40 minutes", 10: "10% of the subtotal" }[s] ?? s;
    } catch {
      return "Generating the bill fails";
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
