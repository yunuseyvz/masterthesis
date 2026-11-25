import { AppError } from "../errors.ts";
import { errorResponse, json } from "../http.ts";
import { parseJsonObject } from "../validation.ts";
import { parsePaymentEvent } from "./handlers.ts";
import { processEventOnce } from "./once.ts";
import type { PaymentDeps } from "./types.ts";

/**
 * Handles one provider delivery. Validates the event, credits it at most once,
 * and answers 200 (including for duplicates) or an error status.
 */
export async function handlePaymentRequest(request: Request, deps: PaymentDeps): Promise<Response> {
  try {
    const raw = parseJsonObject(await request.text());
    const event = parsePaymentEvent(raw);
    const result = await processEventOnce(deps, event);
    return json(200, {
      ok: true,
      duplicate: result.duplicate,
      balanceCents: result.account?.balanceCents,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err);
    }
    return json(500, { ok: false, error: "event processing failed" });
  }
}
