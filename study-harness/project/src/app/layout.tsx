import type { ReactNode } from "react";
import { Header } from "../components/Header";
import "./globals.css";

export const metadata = { title: "Shopfront", description: "A small online shop" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
