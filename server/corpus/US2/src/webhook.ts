import { processWebhook, withRetry } from "./idempotency.ts";
import type { EventLog, Handler, WebhookEvent, WebhookResponse } from "./types.ts";

const MAX_ATTEMPTS = 3;

export async function handleWebhook(log: EventLog, handler: Handler, event: WebhookEvent): Promise<WebhookResponse> {
  try {
    const outcome = await withRetry(() => processWebhook(log, event, handler), MAX_ATTEMPTS);
    return { status: 200, body: outcome };
  } catch {
    return { status: 500, body: "retry later" };
  }
}

export function parseEvent(raw: string): WebhookEvent {
  const data = JSON.parse(raw);
  if (typeof data.id !== "string" || typeof data.accountId !== "string" || typeof data.amountCents !== "number") {
    throw new Error("malformed event");
  }
  return data as WebhookEvent;
}

export function creditHandler(balances: Map<string, number>): Handler {
  return async (event) => {
    const sign = event.type === "payment.refunded" ? -1 : 1;
    balances.set(event.accountId, (balances.get(event.accountId) ?? 0) + sign * event.amountCents);
  };
}
