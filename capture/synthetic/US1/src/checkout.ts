import { AppError } from "../errors.ts";
import { errorResponse, json } from "../http.ts";
import { createLogger } from "../logger.ts";
import { parseJsonObject, requireString } from "../validation.ts";
import { reserveStock } from "./inventory.ts";
import type { Store } from "./types.ts";

export interface CheckoutRequest {
  skuId: string;
  qty: number;
}

const log = createLogger(() => {});

/** Reads a checkout request from a JSON body. A missing or non-numeric qty becomes NaN and is rejected by reserveStock. */
export function parseCheckout(body: string): CheckoutRequest {
  const data = parseJsonObject(body);
  return { skuId: requireString(data.skuId, "skuId"), qty: Number(data.qty) };
}

export function handleCheckout(store: Store, req: CheckoutRequest): Response {
  try {
    const remaining = reserveStock(store, req.skuId, req.qty);
    log.info("reserved", { skuId: req.skuId, qty: req.qty, remaining });
    return json(200, { ok: true, remaining });
  } catch (err) {
    if (err instanceof AppError) {
      log.warn("checkout rejected", { skuId: req.skuId, status: err.status });
    }
    return errorResponse(err);
  }
}
