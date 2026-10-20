import { adjustBalance, type AccountStore } from "../accounts.ts";
import { ValidationError } from "../errors.ts";
import type { Handler, WebhookEvent } from "./types.ts";

export function parseEvent(raw: string): WebhookEvent {
  const data = JSON.parse(raw);
  if (typeof data.id !== "string" || typeof data.accountId !== "string" || typeof data.amountCents !== "number") {
    throw new ValidationError("malformed event");
  }
  return data as WebhookEvent;
}

export function creditHandler(store: AccountStore): Handler {
  return async (event) => {
    const sign = event.type === "payment.refunded" ? -1 : 1;
    adjustBalance(store, event.accountId, sign * event.amountCents);
  };
}
