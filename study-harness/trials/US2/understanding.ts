// Runs the story's code and prints the true option text for every understanding item, in the order of trial.json.
// The harness test compares this output with the item's `correct` index for both variants.

/** A module of the agent's code, or an empty one if it is missing: then only the items that use it fail. */
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { createAccountStore, getAccount } = await optional(import("./src/lib/accounts.ts"));
const { fakeClock } = await optional(import("./src/lib/clock.ts"));
const { applyPayment, parsePaymentEvent } = await optional(import("./src/lib/webhooks/handlers.ts"));
const { processEventOnce } = await optional(import("./src/lib/webhooks/idempotency.ts"));

/** The event log's factory: in src/lib/db.ts as the outline says, or next to the webhook types. */
async function eventLogFactory(): Promise<(clock: unknown) => any> {
  for (const p of ["./src/lib/db.ts", "./src/lib/webhooks/types.ts", "./src/lib/webhooks/event-log.ts", "./src/lib/webhooks/eventLog.ts"]) {
    const m = await import(p).catch(() => ({}));
    if (typeof (m as { createEventLog?: unknown }).createEventLog === "function") return (m as { createEventLog: (c: unknown) => any }).createEventLog;
  }
  return () => { throw new Error("no createEventLog"); };
}
const createEventLog = await eventLogFactory();

/** An account store whose lookups fail with a non-AppError (a temporary failure) while `down` is set. */
function flakyAccounts() {
  const real = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
  const state = { down: true };
  const accounts = { accounts: { get: (id: string) => { if (state.down) throw new Error("database unavailable"); return real.accounts.get(id); } } } as unknown as ReturnType<typeof createAccountStore>;
  return { accounts, real, state };
}
const event = { id: "e", type: "payment.succeeded" as const, accountId: "a", amount: "1.00" };
const delivery = (body: unknown) => new Request("http://localhost/api/webhooks/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const items: (() => Promise<string> | string)[] = [
  // flaw (step 2): the conversion to cents
  () => {
    const accounts = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
    ["0.29", "4.35", "1.15"].forEach((amount, i) => applyPayment({ accounts }, { id: `e${i}`, type: "payment.succeeded", accountId: "a", amount }));
    return String(getAccount(accounts, "a").balanceCents);
  },
  // open case (step 3): a redelivery of an event that was given up
  async () => {
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    await processEventOnce(deps, event, () => { throw new Error("temporary"); }, async () => {}).catch(() => {});
    try {
      const r = await processEventOnce(deps, event, applyPayment, async () => {});
      const balance = getAccount(deps.accounts, "a").balanceCents;
      if (r.duplicate) return balance === 0 ? "It is ignored as a duplicate: the account is never credited" : "?";
      return balance === 100 ? "It is processed again and the account is credited" : balance === 200 ? "The account is credited twice" : "?";
    } catch (err) {
      return (err as { status?: number }).status === 409 ? "It is rejected as a conflict (409)" : "? it throws";
    }
  },
  // interplay (step 3): a delivery while the first is still in flight (step 1's log status)
  async () => {
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    deps.log.start(event.id);
    try {
      const r = await processEventOnce(deps, event, applyPayment, async () => {});
      const balance = getAccount(deps.accounts, "a").balanceCents;
      return r.duplicate && balance === 0 ? "It is accepted as a duplicate, without crediting" : "It credits the account as well";
    } catch {
      return "It fails with an error";
    }
  },
  // dependency (step 4): the endpoint's answer when processing gives up, and whether a redelivery is tried anew
  async () => {
    const { handleWebhookRequest } = await import("./src/lib/webhooks/webhook.ts");
    const { accounts, real, state } = flakyAccounts();
    const deps = { accounts, log: createEventLog(fakeClock()), clock: fakeClock(), maxAttempts: 1 };
    const first: Response = await handleWebhookRequest(delivery(event), deps);
    if (first.status === 200) return "200, so the provider stops and the payment is never credited";
    if (first.status === 409) return "409: rejected as a conflict";
    if (first.status === 400) return "400: rejected as invalid";
    if (first.status < 500) return `? it answers ${first.status}`;
    state.down = false;
    await handleWebhookRequest(delivery(event), deps);
    return real.accounts.get("a")!.balanceCents === 100 ? "An error status (5xx), so the provider delivers it again and it is tried anew" : "? 5xx, but a redelivery is not credited";
  },
  // emergent (step 4): an event type the endpoint does not handle
  async () => {
    const { handleWebhookRequest } = await import("./src/lib/webhooks/webhook.ts");
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 500 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    const res: Response = await handleWebhookRequest(delivery({ ...event, type: "payment.refunded" }), deps);
    const balance = getAccount(deps.accounts, "a").balanceCents;
    if (res.status === 200) return balance === 500 ? "200: accepted and ignored" : "200: the account is debited";
    return { 400: "400: rejected as an invalid event", 500: "500: server error" }[res.status] ?? `It answers ${res.status}`;
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
