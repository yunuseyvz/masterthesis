## Step outline: SLA credits

1. Duration parsing in `src/lib/sla/duration.ts` (with small time helpers in `src/lib/sla/time.ts` if needed): parse
   outage durations such as `"1h 30m"` or `"45m"` into minutes.
2. Types in `src/lib/sla/types.ts`: the billing tiers (how much credit an outage of a given length earns) and the
   invoice with its credit line.
3. The invoice generator in `src/lib/sla/invoice.ts`: measure a customer's outages against the SLA threshold and add
   the credit to the invoice.
4. Unit tests in `test/duration.test.ts`, a README section, then `npm test`.
