import { GET } from "./src/app/api/products/low-stock/route.ts";

const res = await GET(new Request("http://localhost/api/products/low-stock?threshold=abc"));
console.log(String(res.status));
