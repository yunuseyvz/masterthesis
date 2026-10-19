import { getDb } from "../../../../lib/db.ts";
import { errorResponse } from "../../../../lib/http.ts";
import { creditHandler, parseEvent } from "../../../../lib/webhooks/handlers.ts";
import { createEventLog } from "../../../../lib/webhooks/types.ts";
import { handleWebhook } from "../../../../lib/webhooks/webhook.ts";

// Remembers which event ids have been handled, for as long as the process runs.
const log = createEventLog();

export async function POST(request: Request) {
  try {
    const event = parseEvent(await request.text());
    return handleWebhook(log, creditHandler(getDb().accounts), event);
  } catch (err) {
    return errorResponse(err);
  }
}
