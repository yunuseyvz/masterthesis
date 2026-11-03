import type { Account } from "../accounts.ts";
import { AppError } from "../errors.ts";
import { applyPayment } from "./handlers.ts";
import type { PaymentEvent, WebhookDeps } from "./types.ts";

export type PaymentHandler = (deps: WebhookDeps, event: PaymentEvent) => Account;

export interface ProcessResult {
  /** True when this delivery was already handled (or is being handled). */
  duplicate: boolean;
  /** The updated account, only for a delivery that credited the balance. */
  account?: Account;
  attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 50;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Processes an event at most once. Redeliveries of a `processing` or `processed`
 * event are ignored; a `failed` event may be tried again. Temporary failures are
 * retried a bounded number of times, while AppErrors (bad input, unknown account)
 * are permanent and fail immediately.
 */
export async function processEventOnce(
  deps: WebhookDeps,
  event: PaymentEvent,
  handler: PaymentHandler = applyPayment,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<ProcessResult> {
  const existing = deps.log.get(event.id);
  if (existing && existing.status !== "failed") {
    return { duplicate: true, attempts: existing.attempts };
  }

  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const entry = deps.log.start(event.id);
    try {
      const account = handler(deps, event);
      deps.log.succeed(event.id);
      return { duplicate: false, account, attempts: entry.attempts };
    } catch (err) {
      lastError = err;
      deps.log.fail(event.id);
      if (err instanceof AppError) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await wait(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}
