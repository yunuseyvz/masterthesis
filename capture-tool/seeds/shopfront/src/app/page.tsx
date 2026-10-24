import Link from "next/link";

export default function HomePage() {
  return (
    <section>
      <h1>Welcome to Shopfront</h1>
      <p>Browse the catalog or check your account.</p>
      <Link href="/products">See all products</Link>
    </section>
  );
}
