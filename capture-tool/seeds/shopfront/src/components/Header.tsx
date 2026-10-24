import Link from "next/link";

export function Header() {
  return (
    <header className="container">
      <nav>
        <Link href="/">Shopfront</Link> · <Link href="/products">Products</Link>
      </nav>
    </header>
  );
}
