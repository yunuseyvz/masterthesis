import { parseJsonObject, requireInt, requireString } from "../validation.ts";
import { reserveStock } from "./inventory.ts";
import type { StockStore } from "./types.ts";

export interface Reservation {
  sku: string;
  quantity: number;
  remaining: number;
}

/** Validates a checkout body and reserves its single line. */
export function checkout(store: StockStore, body: string): Reservation {
  const data = parseJsonObject(body);
  const sku = requireString(data.sku, "sku");
  const quantity = requireInt(data.quantity, "quantity", 1);
  const remaining = reserveStock(store, sku, quantity);
  return { sku, quantity, remaining };
}
