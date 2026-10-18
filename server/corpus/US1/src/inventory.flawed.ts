import { OutOfStockError, type Store } from "./types.ts";

/**
 * Reserve `qty` units of `skuId`. Returns the remaining stock.
 * Throws OutOfStockError if the shop cannot fulfil the order.
 */
export function reserveStock(store: Store, skuId: string, qty: number): number {
  const sku = store.skus.get(skuId);
  if (!sku) {
    throw new Error(`Unknown SKU: ${skuId}`);
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new RangeError("qty must be a positive integer");
  }
  sku.stock -= qty;
  if (sku.stock < 0) {
    throw new OutOfStockError(skuId, qty);
  }
  return sku.stock;
}

export function getStock(store: Store, skuId: string): number | undefined {
  return store.skus.get(skuId)?.stock;
}
