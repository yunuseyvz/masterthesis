import { reserveStock } from "./inventory.ts";
import { OutOfStockError, type Store } from "./types.ts";

export interface CheckoutRequest {
  skuId: string;
  qty: number;
}

export interface CheckoutResponse {
  status: number;
  body: { ok: boolean; remaining?: number; error?: string };
}

export function handleCheckout(store: Store, req: CheckoutRequest): CheckoutResponse {
  try {
    const remaining = reserveStock(store, req.skuId, req.qty);
    return { status: 200, body: { ok: true, remaining } };
  } catch (err) {
    if (err instanceof OutOfStockError) {
      return { status: 409, body: { ok: false, error: err.message } };
    }
    if (err instanceof RangeError) {
      return { status: 400, body: { ok: false, error: err.message } };
    }
    return { status: 404, body: { ok: false, error: (err as Error).message } };
  }
}

export type Handler = (store: Store, req: CheckoutRequest) => CheckoutResponse;

export const routes: Record<string, Handler> = {
  "POST /checkout": handleCheckout,
};

export function dispatch(store: Store, route: string, req: CheckoutRequest): CheckoutResponse {
  const handler = routes[route];
  if (!handler) {
    return { status: 404, body: { ok: false, error: "No such route" } };
  }
  return handler(store, req);
}
