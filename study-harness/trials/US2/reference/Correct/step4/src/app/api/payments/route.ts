import { systemClock } from "../../../lib/clock.ts";
import { getDb } from "../../../lib/db.ts";
import { handlePaymentRequest } from "../../../lib/payments/receive.ts";

export async function POST(request: Request) {
  const db = getDb();
  return handlePaymentRequest(request, {
    accounts: db.accounts,
    log: db.paymentEvents,
    clock: systemClock,
  });
}
