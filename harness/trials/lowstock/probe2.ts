import { GET } from "./src/app/api/products/low-stock/route.ts";

const res = await GET(new Request("http://localhost/api/products/low-stock?threshold=20"));
console.log((await res.json()).items.map((item: { sku: string }) => item.sku).join(", "));
