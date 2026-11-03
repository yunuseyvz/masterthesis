/** One SKU and how many units of it the shop has. */
export interface SkuStock {
  sku: string;
  stock: number;
}

/** The shop's stock levels, keyed by SKU. */
export interface StockStore {
  stock: Map<string, number>;
}

export function createStockStore(levels: SkuStock[]): StockStore {
  return { stock: new Map(levels.map((level) => [level.sku, level.stock])) };
}
