import { NotFoundError } from "./errors.ts";
import type { Cents } from "./money.ts";

export interface Product {
  productId: string;
  name: string;
  priceCents: Cents;
}

export interface Catalog {
  products: Map<string, Product>;
}

export function createCatalog(products: Product[]): Catalog {
  return { products: new Map(products.map((p) => [p.productId, p])) };
}

export function getProduct(catalog: Catalog, productId: string): Product {
  const product = catalog.products.get(productId);
  if (!product) {
    throw new NotFoundError(`product ${productId}`);
  }
  return product;
}

export function priceOf(catalog: Catalog, productId: string): Cents {
  return getProduct(catalog, productId).priceCents;
}
