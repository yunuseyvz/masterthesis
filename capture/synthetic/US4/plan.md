# Plan: SLA outage credits on the invoice

## Context

- Money is integer cents (`src/lib/money.ts`, `Cents`); balances change through `adjustBalance` in `src/lib/accounts.ts`.
- Outages are reported as durations like `2h`, `45m` or `1h30m`.
- Two billing tiers with different SLA thresholds and credit rates per hour.

## Approach

A `src/lib/sla/` module: duration parsing first, since everything else depends on it, then the tiers, then an invoice generator that measures an outage against the tier's threshold and applies the credit to the account.

## Steps

### 1. Implement duration parsing
- `src/lib/sla/time.ts`: `HOUR_MS`, `MINUTE_MS`, `SECOND_MS`.
- `src/lib/sla/duration.ts`: `parseDurationMs(input): number` for one or more `<n>h|m|s` parts; anything else → `ValidationError`.

### 2. Add billing tiers and the invoice type
- `src/lib/sla/types.ts`: `BillingTier { name; thresholdMs; creditPercentPerHour }`, `TIERS` (standard: 1h threshold, 5 %/h; premium: 30m, 10 %/h), `Invoice { tier; outageMs; billableMs; creditPercent }`.

### 3. Add the SLA credit invoice generator
- `src/lib/sla/invoice.ts`:
  - `createInvoice(tierName, outage)`: unknown tier → `NotFoundError`; works out the billable time against the tier's threshold and the credit percentage from the hourly rate. Outages within the SLA get no credit.
  - `formatInvoice`, `totalCredit(invoices)`, `creditCents(invoice, monthlyFeeCents)` (rounded to the cent), `applyInvoiceCredit(store, accountId, invoice, monthlyFeeCents)`.

### 4. Add unit tests for durations and invoices
- `test/duration.test.ts`: parsing single and combined units, invalid input, an outage within the SLA.
- README: add `sla/` under "Layout".

Shall I go ahead?
