// Runs the story's code and prints the true option text for every understanding item.
// The harness test compares this output with the item's `correct` index for both variants.
import { createAccountStore } from "./src/lib/accounts.ts";
import { createEventLog } from "./src/lib/webhooks/types.ts";
import { creditHandler } from "./src/lib/webhooks/handlers.ts";
import { handleWebhook } from "./src/lib/webhooks/webhook.ts";

const O: string[][] = [["It succeeds on a retry and the account is credited", "It returns 200 OK on a retry, but the account is never credited", "It returns 500 on every retry until the server restarts", "It credits the account twice"], ["It returns 200 with \"duplicate\" and the account is not credited again", "It returns 500, so the provider retries again", "The account is credited a second time", "It throws an unhandled error"], ["1500 cents", "2500 cents", "500 cents", "2000 cents"]];
const idx: number[] = [];
  idx.push(await (async () => { const bal = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]); const inner = creditHandler(bal); let calls = 0; const h = async (e: any) => { if (calls++ === 0) throw new Error("transient"); await inner(e); };
  const r = await handleWebhook(createEventLog(), h, { id: "evt_1", type: "payment.succeeded", accountId: "a", amountCents: 700 }); const credited = bal.accounts.get("a")!.balanceCents;
  return r.status === 200 && credited === 700 ? 0 : r.status === 200 && credited === 0 ? 1 : r.status === 500 ? 2 : credited === 1400 ? 3 : -1; })());
  idx.push(await (async () => { const bal = createAccountStore([{ id: "a", name: "A", balanceCents: 0 }]); const log = createEventLog(); const h = creditHandler(bal); const ev = { id: "evt_2", type: "payment.succeeded" as const, accountId: "a", amountCents: 700 };
  await handleWebhook(log, h, ev); const r = await handleWebhook(log, h, ev); const credited = bal.accounts.get("a")!.balanceCents;
  return r.status === 200 && (await r.text()) === "duplicate" && credited === 700 ? 0 : r.status === 500 ? 1 : credited === 1400 ? 2 : -1; })());
  idx.push(await (async () => { const bal = createAccountStore([{ id: "a", name: "A", balanceCents: 2000 }]); await handleWebhook(createEventLog(), creditHandler(bal), { id: "evt_3", type: "payment.refunded", accountId: "a", amountCents: 500 }); const b = bal.accounts.get("a")!.balanceCents; return b === 1500 ? 0 : b === 2500 ? 1 : b === 500 ? 2 : b === 2000 ? 3 : -1; })());
console.log(JSON.stringify(idx.map((i, k) => O[k]![i] ?? null)));
