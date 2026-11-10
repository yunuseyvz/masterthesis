## Step outline: SLA credits

1. Duration parsing in `src/lib/sla/duration.ts` (with small time helpers in `src/lib/sla/time.ts`: the
   millisecond constants and `minutesBetween(fromMs, toMs)`): `parseDurationMinutes(input)` parses outage durations
   such as `"1h 30m"` or `"45m"` (units `d`, `h`, `m`, `s`, parts separated by spaces) into minutes. Every part needs
   a unit: a bare number such as `"90"` is a `ValidationError`.
2. Types in `src/lib/sla/types.ts`: `SlaTier` (`minOutage`, `creditPercent`), `SlaPolicy` (`threshold`, `tiers`),
   where `minOutage` and `threshold` are durations written as text, such as `"4h"`; `Outage` (`id`, `startedAt`,
   `endedAt`, epoch milliseconds), `InvoiceLine` and `Invoice` (with `creditCents` and `totalCents`);
   `DEFAULT_TIERS`: 5 % of the subtotal from `"30m"`, 10 % from `"4h"`, 25 % from `"12h"`; `DEFAULT_POLICY` with
   the threshold `"30m"` and those tiers.
3. The invoice generator in `src/lib/sla/invoice.ts`: `generateInvoice({ accountId, periodStartMs, periodEndMs,
   subtotalCents, outages, policy })` reads the policy's durations with `parseDurationMinutes` and measures each
   outage within the billing period: an outage that starts before the period or ends after it counts with the part
   that lies inside the period. An outage up to the threshold earns nothing;
   above it, the highest tier it reaches applies, rounded down to whole cents. Add one credit line per outage and
   subtract the credits from the total.
4. Unit tests in `test/duration.test.ts` and `test/sla.test.ts`, a README section, then `npm test`.
