export interface WebhookEvent {
  id: string;
  type: "payment.succeeded" | "payment.refunded";
  accountId: string;
  amountCents: number;
}

export type Handler = (event: WebhookEvent) => Promise<void>;

export interface EventLog {
  processed: Set<string>;
}

export function createEventLog(): EventLog {
  return { processed: new Set() };
}
