import { createEventLog } from "./src/types.ts";
import { processWebhook, withRetry } from "./src/idempotency.ts";

async function main() {
  const log = createEventLog();
  const event = { id: "evt_9", type: "payment.succeeded" as const, accountId: "acc_1", amountCents: 500 };
  let calls = 0;
  const handler = async () => {
    calls++;
    if (calls === 1) throw new Error("transient");
  };
  await withRetry(() => processWebhook(log, event, handler), 3);
  console.log(calls === 2 ? "Re-runs handler" : "Skips as already processed");
}

main();
