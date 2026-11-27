// Prints the true option text of every understanding item, in trial.json order.

// A module of the agent's code, or an empty one if it is missing: then only the items that use it fail.
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { LimitExceededError, ValidationError } = await optional(import("./src/lib/errors.ts"));
const { resolveSellerConfig } = await optional(import("./src/lib/sellers/config.ts"));
const { withinLimit } = await optional(import("./src/lib/sellers/limits.ts"));
const { SHOP_DEFAULTS } = await optional(import("./src/lib/sellers/types.ts"));

const seller = (overrides: unknown) => ({ id: "t", name: "T", overrides }) as never;
// Runs withinLimit and describes what happened, with the texts of `ran` and the error cases.
async function attempt(overrides: unknown, name: string, used: number, amount: number, ran: string): Promise<string> {
  let called = false;
  try {
    await withinLimit(seller(overrides), name as never, used, () => { called = true; }, amount);
    return called ? ran : "? nothing ran, but no error";
  } catch (err) {
    if (err instanceof LimitExceededError && !called) return "rejected 429";
    if (err instanceof ValidationError) return "rejected 400";
    return err instanceof TypeError ? "TypeError" : "? it throws";
  }
}

const items: (() => Promise<string> | string)[] = [
  // open case (step 2): a limit overridden with null
  () => {
    try {
      const v = resolveSellerConfig(seller({ limits: { maxUsers: null } })).limits.maxUsers;
      return v === SHOP_DEFAULTS.limits.maxUsers ? "The shop default" : v === 0 ? "0" : v === null || v === Infinity || v === undefined ? "No limit at all" : `? ${v}`;
    } catch {
      return "Resolving its configuration throws";
    }
  },
  // emergent (step 2): an override for a limit that does not exist
  () => {
    try {
      const limits = resolveSellerConfig(seller({ limits: { maxWidgets: 3 } })).limits as Record<string, unknown>;
      if (limits.maxUsers === 3) return "It replaces maxUsers";
      return "maxWidgets" in limits ? "It is kept in the effective limits" : "It is dropped from the effective limits";
    } catch {
      return "Resolving the configuration rejects it as invalid";
    }
  },
  // dependency (step 3): the limit check relies on every effective limit being a number
  async () => {
    const r = await attempt({ limits: { maxProducts: null } }, "maxProducts", 100, 1, "It runs: null means the seller has no limit");
    return { "rejected 429": "It is rejected: limit exceeded (429)", "rejected 400": "It is rejected as invalid (400)", TypeError: "It fails with a TypeError" }[r] ?? r;
  },
  // flaw (step 3): a bulk import that does not fit
  async () => {
    const r = await attempt({}, "maxProducts", 98, 5, "The import runs and all 5 are added");
    return { "rejected 429": "The import is rejected (429)", "rejected 400": "The import is rejected as invalid (400)", TypeError: "The import fails with a TypeError" }[r] ?? r;
  },
  // interplay (steps 2 and 3): a limit of 0 is a value, not "not set"
  async () => {
    const limit = resolveSellerConfig(seller({ limits: { maxUsers: 0 } })).limits.maxUsers;
    const r = await attempt({ limits: { maxUsers: 0 } }, "maxUsers", 0, 1, limit === 0 || limit === null ? "It runs: 0 means no limit" : "It runs: 0 counts as not set, so the default of 5 applies");
    return { "rejected 429": "It is rejected: limit exceeded (429)", "rejected 400": "It is rejected as invalid (400)", TypeError: "It fails with a TypeError" }[r] ?? r;
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
