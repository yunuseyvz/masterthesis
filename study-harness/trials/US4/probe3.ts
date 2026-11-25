import { generateBill } from "./src/lib/refunds/bill.ts";
import { DEFAULT_POLICY } from "./src/lib/refunds/types.ts";

const MIN = 60_000;
const end = 30 * 24 * 60 * MIN;
const bill = generateBill({ accountId: "a", periodStartMs: 0, periodEndMs: end, subtotalCents: 10_000, policy: DEFAULT_POLICY, outages: [{ id: "o", startedAt: end - 60 * MIN, endedAt: end + 60 * MIN }] });
console.log(String(bill.refundCents));
