import type { AccountStore } from "../accounts.ts";
import type { Clock } from "../clock.ts";

/** The only payment event type this endpoint accepts. */
export type PaymentEventType = "payment.succeeded";

/** A payment event as sent by the provider. `amount` is in dollars, e.g. "15.00". */
export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  accountId: string;
  amount: string;
}

/** Where an event is in its (at most once) processing lifecycle. */
export type ProcessedStatus = "processing" | "processed" | "failed";

export interface EventLogEntry {
  eventId: string;
  status: ProcessedStatus;
  attempts: number;
  at: number;
}

/** The event log that makes redelivering the same event safe. */
export interface EventLog {
  readonly entries: Map<string, EventLogEntry>;
  get(eventId: string): EventLogEntry | undefined;
  /** Records the event as in flight, incrementing its attempt count. */
  start(eventId: string): EventLogEntry;
  succeed(eventId: string): EventLogEntry;
  fail(eventId: string): EventLogEntry;
}

/** Everything the webhook handler needs, injected so tests stay deterministic. */
export interface WebhookDeps {
  accounts: AccountStore;
  log: EventLog;
  clock: Clock;
  /** How many times a temporarily failing event is tried in total. */
  maxAttempts?: number;
}
