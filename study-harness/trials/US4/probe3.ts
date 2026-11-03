import { generateInvoice } from "./src/lib/sla/invoice.ts";
import { DEFAULT_POLICY } from "./src/lib/sla/types.ts";

const MIN = 60_000;
const end = 30 * 24 * 60 * MIN;
const invoice = generateInvoice({ accountId: "a", periodStartMs: 0, periodEndMs: end, subtotalCents: 10_000, policy: DEFAULT_POLICY, outages: [{ id: "o", startedAt: end - 60 * MIN, endedAt: end + 60 * MIN }] });
console.log(String(invoice.creditCents));
