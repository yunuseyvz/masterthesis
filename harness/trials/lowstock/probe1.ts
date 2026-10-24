import { getDb } from "./src/lib/db.ts";

console.log(String(getDb().catalog.products.get("pen")?.stock));
