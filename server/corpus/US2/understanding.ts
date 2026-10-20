// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { createAccountStore } from "./src/lib/accounts.ts";
import { createEventLog } from "./src/lib/webhooks/types.ts";
import { creditHandler, parseEvent } from "./src/lib/webhooks/handlers.ts";
import { handleWebhook } from "./src/lib/webhooks/webhook.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  async () => {
    const log = createEventLog();
    log.processed.add("evt_1");
    log.processed.add("evt_1");
    return String(log.processed.size);
  },
  // step 2
  async () => {
    const bal = createAccountStore([{ id: "a", name: "A", balanceCents: 1000 }]);
    try {
      await creditHandler(bal)(parseEvent(JSON.stringify({ id: "evt_5", type: "payment.failed", accountId: "a", amountCents: 500 })));
    } catch {
      // rejected while parsing
    }
    const b = bal.accounts.get("a")!.balanceCents;
    return b === 1000 ? "1000 cents: the event is rejected" : b === 1500 ? "1500 cents" : b === 500 ? "500 cents" : "?";
  },
  // step 3
  async () => {
    const bal = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]);
    const log = createEventLog();
    const h = creditHandler(bal);
    const ev = { id: "evt_2", type: "payment.succeeded" as const, accountId: "a", amountCents: 700 };
    await handleWebhook(log, h, ev);
    const r = await handleWebhook(log, h, ev);
    const credited = bal.accounts.get("a")!.balanceCents;
    return r.status === 200 && (await r.text()) === "duplicate" && credited === 700 ? 'It returns 200 with "duplicate" and the account is not credited again' : credited === 1400 ? "The account is credited a second time" : "?";
  },
  // step 4
  async () => {
    let calls = 0;
    const r = await handleWebhook(createEventLog(), async () => {
      calls++;
      throw new Error("down");
    }, { id: "evt_3", type: "payment.succeeded", accountId: "a", amountCents: 1 });
    return r.status === 500 ? String(calls) : "?";
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
