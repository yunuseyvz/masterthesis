import { NotFoundError, OutOfStockError, ValidationError } from "../errors.ts";
import type { StockStore } from "./types.ts";

function availableStock(store: StockStore, productId: string): number {
  const available = store.stock.get(productId);
  if (available === undefined) {
    throw new NotFoundError(`product ${productId}`);
  }
  return available;
}

/** How many units of `productId` are currently available. */
export function stockOf(store: StockStore, productId: string): number {
  return availableStock(store, productId);
}

/** Holds `quantity` units of `productId` and returns the remaining stock. */
export function reserveStock(store: StockStore, productId: string, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError("quantity must be a positive integer");
  }
  const available = availableStock(store, productId);
  if (available < quantity) {
    throw new OutOfStockError(productId, quantity, available);
  }
  const remaining = available - quantity;
  store.stock.set(productId, remaining);
  return remaining;
}
