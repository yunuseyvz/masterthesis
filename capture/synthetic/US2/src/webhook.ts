import { text } from "../http.ts";
import { processWebhook, withRetry } from "./idempotency.ts";
import type { EventLog, Handler, WebhookEvent } from "./types.ts";

const MAX_ATTEMPTS = 3;

export async function handleWebhook(log: EventLog, handler: Handler, event: WebhookEvent): Promise<Response> {
  try {
    const outcome = await withRetry(() => processWebhook(log, event, handler), MAX_ATTEMPTS);
    return text(200, outcome);
  } catch {
    return text(500, "retry later");
  }
}
