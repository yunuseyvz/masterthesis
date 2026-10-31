import { systemClock } from "../../../../lib/clock.ts";
import { getDb } from "../../../../lib/db.ts";
import { handleWebhookRequest } from "../../../../lib/webhooks/webhook.ts";

export async function POST(request: Request) {
  const db = getDb();
  return handleWebhookRequest(request, {
    accounts: db.accounts,
    log: db.webhookEvents,
    clock: systemClock,
  });
}
