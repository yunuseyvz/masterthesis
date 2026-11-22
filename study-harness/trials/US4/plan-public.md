Here is the plan for the SLA credits, in four steps.

1. **Durations**: `src/lib/sla/duration.ts` with `parseDurationMinutes`, and `src/lib/sla/time.ts` with the small time helpers it needs.
2. **Types**: `src/lib/sla/types.ts` with `SlaTier`, `SlaPolicy`, `Outage`, `InvoiceLine`, `Invoice`, `DEFAULT_TIERS` and `DEFAULT_POLICY`.
3. **The invoice**: `src/lib/sla/invoice.ts` with `generateInvoice`, which measures the outages against the policy and credits them on the invoice.
4. **Tests and docs**: `test/duration.test.ts`, `test/sla.test.ts` and a section in `README.md`, then `npm test`.
