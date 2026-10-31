// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { createAccountStore, getAccount } from "./src/lib/accounts.ts";
import { fakeClock } from "./src/lib/clock.ts";
import { applyPayment, parsePaymentEvent } from "./src/lib/webhooks/handlers.ts";
import { processEventOnce } from "./src/lib/webhooks/idempotency.ts";

/** The event log's factory: in src/lib/db.ts as the outline says, or next to the webhook types. */
async function eventLogFactory(): Promise<(clock: unknown) => any> {
  for (const p of ["./src/lib/db.ts", "./src/lib/webhooks/types.ts", "./src/lib/webhooks/event-log.ts", "./src/lib/webhooks/eventLog.ts"]) {
    const m = await import(p).catch(() => ({}));
    if (typeof (m as { createEventLog?: unknown }).createEventLog === "function") return (m as { createEventLog: (c: unknown) => any }).createEventLog;
  }
  throw new Error("no createEventLog");
}
const createEventLog = await eventLogFactory();

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    // Which form of amount does the parser accept: a dollar string, or a number?
    const accepts = (amount: unknown) => {
      try {
        parsePaymentEvent({ id: "e", type: "payment.succeeded", accountId: "a", amount });
        return true;
      } catch {
        return false;
      }
    };
    const string = accepts("15.00");
    const number = accepts(1500);
    if (string && !number) return "Dollars, as a decimal string such as \"15.00\"";
    if (number && !string) return "Integer cents";
    return `? string ${string}, number ${number}`;
  },
  // step 2
  () => {
    const accounts = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
    ["0.29", "4.35", "1.15"].forEach((amount, i) => applyPayment({ accounts }, { id: `e${i}`, type: "payment.succeeded", accountId: "a", amount }));
    return String(getAccount(accounts, "a").balanceCents);
  },
  // step 3
  async () => {
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    let tries = 0;
    try {
      await processEventOnce(deps, { id: "e", type: "payment.succeeded", accountId: "a", amount: "1.00" }, () => {
        tries++;
        throw new Error("temporary");
      }, async () => {});
    } catch {
      // gave up
    }
    return String(tries);
  },
  // step 4
  async () => {
    const { handleWebhookRequest } = await import("./src/lib/webhooks/webhook.ts");
    const deps = { accounts: createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]), log: createEventLog(fakeClock()), clock: fakeClock() };
    const deliver = () => handleWebhookRequest(new Request("http://localhost/api/webhooks/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "evt_1", type: "payment.succeeded", accountId: "a", amount: "10.00" }) }), deps);
    await deliver();
    const second: Response = await deliver();
    const balance = getAccount(deps.accounts, "a").balanceCents;
    if (second.status === 200) return balance === 1000 ? "200: accepted, without crediting again" : "200: accepted and credited again";
    return { 409: "409: rejected as a conflict", 400: "400: rejected as invalid", 500: "500: server error" }[second.status] ?? `It answers ${second.status}`;
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
