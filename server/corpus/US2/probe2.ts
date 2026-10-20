import { parseEvent } from "./src/lib/webhooks/handlers.ts";

try {
  const e = parseEvent(JSON.stringify({ id: "evt_5", type: "payment.failed", accountId: "acc_1", amountCents: 500 }));
  console.log(e.type === "payment.failed" ? "Returns the event unchanged" : "Returns the event as a refund");
} catch {
  console.log("Throws a validation error");
}
