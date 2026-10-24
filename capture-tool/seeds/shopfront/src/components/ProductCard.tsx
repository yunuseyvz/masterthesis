import { formatCents } from "../lib/money";
import type { Product } from "../lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article>
      <h2>{product.name}</h2>
      <p>{formatCents(product.priceCents)}</p>
    </article>
  );
}
