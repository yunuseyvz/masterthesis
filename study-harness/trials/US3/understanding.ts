// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { QuotaExceededError, ValidationError } = await optional(import("./src/lib/errors.ts"));
const { resolveTenantConfig } = await optional(import("./src/lib/tenants/config.ts"));
const { withQuota } = await optional(import("./src/lib/tenants/quota.ts"));
const { ORGANIZATION_DEFAULTS } = await optional(import("./src/lib/tenants/types.ts"));

const tenant = (overrides: unknown) => ({ id: "t", name: "T", overrides }) as never;
/** Runs withQuota and describes what happened, with the texts of `ran` and the error cases. */
async function attempt(overrides: unknown, name: string, used: number, amount: number, ran: string): Promise<string> {
  let called = false;
  try {
    await withQuota(tenant(overrides), name as never, used, () => { called = true; }, amount);
    return called ? ran : "? nothing ran, but no error";
  } catch (err) {
    if (err instanceof QuotaExceededError && !called) return "rejected 429";
    if (err instanceof ValidationError) return "rejected 400";
    return err instanceof TypeError ? "TypeError" : "? it throws";
  }
}

const items: (() => Promise<string> | string)[] = [
  // open case (step 2): a limit overridden with null
  () => {
    try {
      const v = resolveTenantConfig(tenant({ limits: { maxUsers: null } })).limits.maxUsers;
      return v === ORGANIZATION_DEFAULTS.limits.maxUsers ? "The organization default" : v === 0 ? "0" : v === null || v === Infinity || v === undefined ? "No limit at all" : `? ${v}`;
    } catch {
      return "Resolving its configuration throws";
    }
  },
  // emergent (step 2): an override for a limit that does not exist
  () => {
    try {
      const limits = resolveTenantConfig(tenant({ limits: { maxWidgets: 3 } })).limits as Record<string, unknown>;
      if (limits.maxUsers === 3) return "It replaces maxUsers";
      return "maxWidgets" in limits ? "It is kept in the effective limits" : "It is dropped: the effective limits are only the known ones";
    } catch {
      return "Resolving the configuration rejects it as invalid";
    }
  },
  // dependency (step 3): the quota check relies on every effective limit being a number
  async () => {
    const r = await attempt({ limits: { maxProducts: null } }, "maxProducts", 100, 1, "It runs: the tenant has no limit");
    return { "rejected 429": "It is rejected: quota exceeded (429)", "rejected 400": "It is rejected as invalid (400)", TypeError: "It fails with a TypeError" }[r] ?? r;
  },
  // flaw (step 3): a bulk import that does not fit
  async () => {
    const r = await attempt({}, "maxProducts", 98, 5, "The import runs");
    return { "rejected 429": "The import is rejected: quota exceeded (429)", "rejected 400": "The import is rejected as invalid (400)" }[r] ?? r;
  },
  // interplay (steps 2 and 3): a limit of 0 is a value, not "not set"
  async () => {
    const limit = resolveTenantConfig(tenant({ limits: { maxUsers: 0 } })).limits.maxUsers;
    const r = await attempt({ limits: { maxUsers: 0 } }, "maxUsers", 0, 1, limit === 0 || limit === null ? "It runs: 0 means no limit" : "It runs: 0 counts as not set, so the default of 5 applies");
    return { "rejected 429": "It is rejected: quota exceeded (429)", "rejected 400": "It is rejected as invalid (400)" }[r] ?? r;
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
