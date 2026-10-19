import { AppError } from "../errors.ts";

export interface Sku {
  id: string;
  stock: number;
}

export interface Store {
  skus: Map<string, Sku>;
}

export class OutOfStockError extends AppError {
  readonly skuId: string;
  readonly requested: number;

  constructor(skuId: string, requested: number) {
    super(409, `Not enough stock for ${skuId} (requested ${requested})`);
    this.skuId = skuId;
    this.requested = requested;
  }
}

export function createStore(initial: Record<string, number>): Store {
  const skus = new Map<string, Sku>();
  for (const [id, stock] of Object.entries(initial)) {
    skus.set(id, { id, stock });
  }
  return { skus };
}
