Here is the plan for the outage refunds, in four steps.

1. **Durations**: `src/lib/refunds/duration.ts` with `parseDurationMinutes`, and `src/lib/refunds/time.ts` with the small time helpers it needs.
2. **Types**: `src/lib/refunds/types.ts` with `RefundTier`, `RefundPolicy`, `Outage`, `BillLine`, `Bill`, `DEFAULT_TIERS` and `DEFAULT_POLICY`.
3. **The bill**: `src/lib/refunds/bill.ts` with `generateBill`, which measures the outages against the policy and refunds them on the bill.
4. **Tests and docs**: `test/duration.test.ts`, `test/refunds.test.ts` and a section in `README.md`, then `npm test`.
