// Prints the true option text of every understanding item, in trial.json order.
import { STATUS_CODES } from "node:http";

// Any other status in the options' form ("404: not found"); "?" (not graded) when it has no name.
const statusText = (status: number) => (STATUS_CODES[status] ? `${status}: ${STATUS_CODES[status]!.toLowerCase()}` : `? it answers ${status}`);

// A module of the agent's code, or an empty one if it is missing: then only the items that use it fail.
const optional = <T,>(m: Promise<T>): Promise<T> => m.catch(() => ({}) as T);
const { createAccountStore, getAccount } = await optional(import("./src/lib/accounts.ts"));
const { fakeClock } = await optional(import("./src/lib/clock.ts"));
const { applyPayment, parsePaymentEvent } = await optional(import("./src/lib/payments/handlers.ts"));
const { processEventOnce } = await optional(import("./src/lib/payments/once.ts"));

// The event log's factory: in src/lib/db.ts as the outline says, or next to the payment types.
async function eventLogFactory(): Promise<(clock: unknown) => any> {
  for (const p of ["./src/lib/db.ts", "./src/lib/payments/types.ts", "./src/lib/payments/event-log.ts", "./src/lib/payments/eventLog.ts"]) {
    const m = await import(p).catch(() => ({}));
    if (typeof (m as { createEventLog?: unknown }).createEventLog === "function") return (m as { createEventLog: (c: unknown) => any }).createEventLog;
  }
  return () => { throw new Error("no createEventLog"); };
}
const createEventLog = await eventLogFactory();

// An account store whose lookups fail with a non-AppError (a temporary failure) while `down` is set.
function flakyAccounts() {
  const real = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
  const state = { down: true };
  const accounts = { accounts: { get: (id: string) => { if (state.down) throw new Error("database unavailable"); return real.accounts.get(id); } } } as unknown as ReturnType<typeof createAccountStore>;
  return { accounts, real, state };
}
const event = { id: "e", type: "payment.succeeded" as const, accountId: "a", amount: "1.00" };
const delivery = (body: unknown) => new Request("http://localhost/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const items: (() => Promise<string> | string)[] = [
  // flaw (step 2): the conversion to cents
  () => {
    const accounts = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
    ["0.29", "4.35", "1.15"].forEach((amount, i) => applyPayment({ accounts }, { id: `e${i}`, type: "payment.succeeded", accountId: "a", amount }));
    return String(getAccount(accounts, "a").balanceCents);
  },
  // open case (step 3): a repeated delivery of an event that was given up
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
      return r.duplicate && balance === 0 ? "It is accepted as a duplicate, without crediting" : "It is processed as well and credits the account again";
    } catch {
      return "It fails with an error and nothing is credited";
    }
  },
  // dependency (step 4): the endpoint's answer when processing gives up, and whether a repeated delivery is tried anew
  async () => {
    const { handlePaymentRequest } = await import("./src/lib/payments/receive.ts");
    const { accounts, real, state } = flakyAccounts();
    const deps = { accounts, log: createEventLog(fakeClock()), clock: fakeClock(), maxAttempts: 1 };
    const first: Response = await handlePaymentRequest(delivery(event), deps);
    if (first.status === 200) return "200: the provider stops delivering it";
    if (first.status === 409) return "409: rejected as a conflict";
    if (first.status === 400) return "400: rejected as invalid";
    if (first.status < 500) return `? it answers ${first.status}`;
    state.down = false;
    await handlePaymentRequest(delivery(event), deps);
    return real.accounts.get("a")!.balanceCents === 100 ? "5xx: the provider delivers it again" : "? 5xx, but a repeated delivery is not credited";
  },
  // emergent (step 4): an event type the endpoint does not handle
  async () => {
    const { handlePaymentRequest } = await import("./src/lib/payments/receive.ts");
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 500 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    const res: Response = await handlePaymentRequest(delivery({ ...event, type: "payment.refunded" }), deps);
    const balance = getAccount(deps.accounts, "a").balanceCents;
    if (res.status === 200) return balance === 500 ? "200: accepted and ignored" : "200: the account is debited";
    return { 400: "400: rejected as an invalid event", 500: "500: it fails with a server error" }[res.status] ?? statusText(res.status);
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
