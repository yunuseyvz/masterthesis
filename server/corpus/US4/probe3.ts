import { createInvoice } from "./src/lib/sla/invoice.ts";

console.log(String(createInvoice("standard", "2h").billableMs));
