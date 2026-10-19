import { ProductCard } from "../../components/ProductCard";
import { getDb } from "../../lib/db";

export default function ProductsPage() {
  const products = [...getDb().catalog.products.values()];
  return (
    <section>
      <h1>Products</h1>
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </div>
    </section>
  );
}
