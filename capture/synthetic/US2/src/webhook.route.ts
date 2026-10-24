import { getDb } from "../../../../lib/db.ts";
import { errorResponse } from "../../../../lib/http.ts";
import { creditHandler, parseEvent } from "../../../../lib/webhooks/handlers.ts";
import { handleWebhook } from "../../../../lib/webhooks/webhook.ts";

export async function POST(request: Request) {
  try {
    const event = parseEvent(await request.text());
    const db = getDb();
    return handleWebhook(db.webhookEvents, creditHandler(db.accounts), event);
  } catch (err) {
    return errorResponse(err);
  }
}
