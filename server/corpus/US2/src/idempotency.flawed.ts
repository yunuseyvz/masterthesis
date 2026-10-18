import type { EventLog, Handler, WebhookEvent } from "./types.ts";

export type Outcome = "processed" | "duplicate";

/** Runs the handler once per event id. Redelivered events are skipped. */
export async function processWebhook(log: EventLog, event: WebhookEvent, handler: Handler): Promise<Outcome> {
  if (log.processed.has(event.id)) {
    return "duplicate";
  }
  log.processed.add(event.id);
  await handler(event);
  return "processed";
}

/** Calls `fn` up to `attempts` times and rethrows the last error. */
export async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
