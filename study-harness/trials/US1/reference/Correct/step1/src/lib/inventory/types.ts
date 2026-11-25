/** One product and how many units of it the shop has. */
export interface ProductStock {
  productId: string;
  stock: number;
}

/** The shop's stock levels, keyed by product. */
export interface StockStore {
  stock: Map<string, number>;
}

export function createStockStore(levels: ProductStock[]): StockStore {
  return { stock: new Map(levels.map((level) => [level.productId, level.stock])) };
}
