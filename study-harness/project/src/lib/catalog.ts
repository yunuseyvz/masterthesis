import { NotFoundError } from "./errors.ts";
import type { Cents } from "./money.ts";

export interface Product {
  sku: string;
  name: string;
  priceCents: Cents;
}

export interface Catalog {
  products: Map<string, Product>;
}

export function createCatalog(products: Product[]): Catalog {
  return { products: new Map(products.map((p) => [p.sku, p])) };
}

export function getProduct(catalog: Catalog, sku: string): Product {
  const product = catalog.products.get(sku);
  if (!product) {
    throw new NotFoundError(`product ${sku}`);
  }
  return product;
}

export function priceOf(catalog: Catalog, sku: string): Cents {
  return getProduct(catalog, sku).priceCents;
}
