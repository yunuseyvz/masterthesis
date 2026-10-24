// Runs the story's code and prints the true option text for every understanding item (one per agent step).
// The harness test compares this output with the item's `correct` index for both variants.
import { readFileSync } from "node:fs";
import { createAccountStore, getAccount } from "./src/lib/accounts.ts";
import { fakeClock } from "./src/lib/clock.ts";
import { createEventLog } from "./src/lib/db.ts";
import { applyPayment } from "./src/lib/webhooks/handlers.ts";
import { processEventOnce } from "./src/lib/webhooks/idempotency.ts";

const items: (() => Promise<string> | string)[] = [
  // step 1
  () => {
    const t = readFileSync("src/lib/webhooks/types.ts", "utf8");
    return /amount: string;/.test(t) && /in dollars, e\.g\. "15\.00"/.test(t) ? "Dollars, as a decimal string such as \"15.00\"" : "?";
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
  () => {
    const t = readFileSync("test/webhook.test.ts", "utf8");
    return /retries a temporary failure/.test(t) && !/signature/i.test(t) && !/refund/i.test(t) && !/same moment|concurren|parallel/i.test(t) ? "Retrying a temporary failure" : "?";
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
