## Step outline: outage refunds

1. Duration parsing in `src/lib/refunds/duration.ts` (with small time helpers in `src/lib/refunds/time.ts`: the
   millisecond constants and `minutesBetween(fromMs, toMs)`): `parseDurationMinutes(input)` parses outage durations
   such as `"1h 30m"` or `"45m"` (units `d`, `h`, `m`, `s`, parts separated by spaces) into minutes. Every part needs
   a unit: a bare number such as `"90"` is a `ValidationError`.
2. Types in `src/lib/refunds/types.ts`: `RefundTier` (`minOutage`, `refundPercent`), `RefundPolicy` (`threshold`, `tiers`),
   where `minOutage` and `threshold` are durations written as text, such as `"4h"`; `Outage` (`id`, `startedAt`,
   `endedAt`, epoch milliseconds), `BillLine` and `Bill` (with `refundCents` and `totalCents`);
   `DEFAULT_TIERS`: 5 % of the subtotal from `"30m"`, 10 % from `"4h"`, 25 % from `"12h"`; `DEFAULT_POLICY` with
   the threshold `"30m"` and those tiers.
3. The bill generator in `src/lib/refunds/bill.ts`: `generateBill({ accountId, periodStartMs, periodEndMs,
   subtotalCents, outages, policy })` reads the policy's durations with `parseDurationMinutes` and measures each
   outage within the billing month: an outage that starts before the month or ends after it counts with the part
   that lies inside the month. An outage up to the threshold earns nothing;
   above it, the highest tier it reaches applies, rounded down to whole cents. Add one refund line per outage and
   subtract the refunds from the total.
4. Unit tests in `test/duration.test.ts` and `test/refunds.test.ts`, a README section, then `npm test`.
