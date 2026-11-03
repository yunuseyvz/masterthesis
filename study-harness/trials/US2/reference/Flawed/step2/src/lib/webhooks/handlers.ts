import { adjustBalance, type Account } from "../accounts.ts";
import { ValidationError } from "../errors.ts";
import type { Cents } from "../money.ts";
import { requireString } from "../validation.ts";
import type { PaymentEvent, WebhookDeps } from "./types.ts";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Converts a decimal dollar string such as "15.00" to integer cents.
 * Parses the digits directly instead of going through floating point.
 */
export function dollarsToCents(amount: string): Cents {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new ValidationError(`amount must be a positive dollar amount with at most 2 decimals: ${amount}`);
  }
  const [whole, fraction = ""] = amount.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new ValidationError(`amount must be greater than zero: ${amount}`);
  }
  return cents;
}

/** Validates an incoming payment event, including its dollar amount. */
export function parsePaymentEvent(raw: Record<string, unknown>): PaymentEvent {
  const id = requireString(raw.id, "id");
  const accountId = requireString(raw.accountId, "accountId");
  const type = requireString(raw.type, "type");
  if (type !== "payment.succeeded") {
    throw new ValidationError(`type must be payment.succeeded`);
  }
  const amount = requireString(raw.amount, "amount");
  dollarsToCents(amount);
  return { id, type: "payment.succeeded", accountId, amount };
}

/** Credits the event's amount to the account and returns the updated account. */
export function applyPayment(deps: Pick<WebhookDeps, "accounts">, event: PaymentEvent): Account {
  return adjustBalance(deps.accounts, event.accountId, Math.floor(Number(event.amount) * 100));
}
