import { NotFoundError, OutOfStockError, ValidationError } from "../errors.ts";
import type { StockStore } from "./types.ts";

function availableStock(store: StockStore, sku: string): number {
  const available = store.stock.get(sku);
  if (available === undefined) {
    throw new NotFoundError(`product ${sku}`);
  }
  return available;
}

/** How many units of `sku` are currently available. */
export function stockOf(store: StockStore, sku: string): number {
  return availableStock(store, sku);
}

/** Holds `quantity` units of `sku` and returns the remaining stock. */
export function reserveStock(store: StockStore, sku: string, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError("quantity must be a positive integer");
  }
  const available = availableStock(store, sku);
  if (available < quantity) {
    throw new OutOfStockError(sku, quantity, available);
  }
  const remaining = available - quantity;
  if (remaining > 0) store.stock.set(sku, remaining);
  else store.stock.delete(sku);
  return remaining;
}
