# US4: SLA Credits

Platz: Milestone Schritt 1, Flaw Schritt 3

## Öffentlich

### Story

As a billing owner, I want outages measured against our SLA and credited on the invoice, so that customers are compensated when we miss the SLA.

Acceptance criteria:
- An outage longer than the SLA threshold earns a credit on the invoice; a shorter one earns none.
- The longer the outage, the higher the credit tier it reaches.
- The part of an outage that lies inside the billing period counts, even if the outage began before the period or ended after it.
- The SLA writes its durations the way people do, such as "30m" or "1h 30m".

### Public Plan

Here is the plan for the SLA credits, in four steps.

1. **Durations**: `src/lib/sla/duration.ts` with `parseDurationMinutes`, and `src/lib/sla/time.ts` with the small time helpers it needs.
2. **Types**: `src/lib/sla/types.ts` with `SlaTier`, `SlaPolicy`, `Outage`, `InvoiceLine`, `Invoice`, `DEFAULT_TIERS` and `DEFAULT_POLICY`.
3. **The invoice**: `src/lib/sla/invoice.ts` with `generateInvoice`, which measures the outages against the policy and credits them on the invoice.
4. **Tests and docs**: `test/duration.test.ts`, `test/sla.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 1)

- **Der Fall:** Eine Dauer ohne Einheit, etwa `"90"`.
- **Warum die Story still ist:** Kriterium 4 zeigt nur Beispiele mit Einheit.
- **Vernünftige Lösungen:** als Minuten lesen, oder ablehnen.
- **Im Secret Plan:** Jeder Teil braucht eine Einheit, `"90"` ist ein `ValidationError`.
- **Baut darauf auf:** `invoice.ts` (Schritt 3) liest Schwelle und Stufen der Policy mit `parseDurationMinutes`. Eine Policy mit `"30"` lässt das Erzeugen der Rechnung scheitern.

### Der Flaw (Schritt 3)

- **Correct:** Der Teil eines Ausfalls innerhalb der Periode zählt.
- **Flawed:** Ausfälle, die über eine Periodengrenze reichen, werden übersprungen.
- **Widerspricht:** Kriterium 3.
- **Warum die Tests es nicht finden:** Testausfälle liegen meist ganz innerhalb der Periode.
- **Beobachtbar:** Ausfall beginnt 60 Minuten vor Periodenende, dauert 2 h, Subtotal 10000: 500 gegen 0.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline-correct.md`); Flawed ändert nur Schritt 3.

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

Flawed statt dessen: Nur Ausfälle, die ganz in der Periode liegen, zählen; einer über die Grenze „wird vom Support von Hand geregelt“ und übersprungen.

### Bezug zum Bestandscode

`money.ts` (`assertCents`, `sumCents`) wird genutzt.

## Emergent

- **Der Fall:** Eine Einheit als Großbuchstabe, `"2H"`.
- **Mögliche Ausgänge:** wie `"2h"` lesen, oder ablehnen.
- **Skript:** `parseDurationMinutes("2H")`.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. What does parseDurationMinutes("2h 15m") return?
   Optionen: 135 / 2.25 / 215 / It throws
   Antwort: 135
2. Under the default policy, from how many outage minutes on does an outage earn a credit?
   Optionen: More than 30 / 60 or more / Any outage / More than 240
   Antwort: More than 30
3. An outage starts 60 minutes before the end of the billing period and lasts 2 hours. The subtotal is 10000 cents. What credit does generateInvoice give?
   Optionen: 500 / 0 / 1000 / 2500
   Antwort: Correct: 500 · Flawed: 0

### Understanding-Items

1. **Milestone, offener Fall** (Schritt 1): What does parseDurationMinutes do with "90", a number without a unit?
   Optionen: It rejects it as invalid / It returns 90 (minutes) / It returns 1.5 (seconds) / It returns 5400 (hours)
   Antwort in der Referenz: It rejects it as invalid
2. **Emergent** (Schritt 1): What does parseDurationMinutes do with "2H", the unit as a capital letter?
   Optionen: It returns 120 / It rejects it as invalid / It returns 2 / It returns 0
   Antwort in der Referenz: It returns 120
3. **Milestone, Abhängigkeit** (Schritt 3): Someone writes a policy with the threshold "30" instead of "30m". What happens when an invoice is generated with it?
   Optionen: Generating the invoice fails with a validation error / The threshold is read as 30 minutes / The threshold is read as 30 hours / The threshold is ignored and every outage earns a credit
   Antwort in der Referenz: Generating the invoice fails with a validation error
4. **Flaw** (Schritt 3): An outage started 3 days before the billing period and ended 1 hour into it. What does the invoice credit for it (default policy)?
   Optionen: 5% of the subtotal, for the hour inside the period / Nothing: the outage is left out / 25% of the subtotal, for the whole outage / 10% of the subtotal
   Antwort in der Referenz: Correct: 5% of the subtotal, for the hour inside the period · Flawed: Nothing: the outage is left out
5. **Zusammenspiel** (Schritt 3): Two outages of 20 minutes each fall into the same billing period (default policy, threshold "30m"). What does the invoice credit?
   Optionen: Nothing: each outage is measured on its own / 5% of the subtotal: together they last 40 minutes / 10% of the subtotal / Generating the invoice fails
   Antwort in der Referenz: Nothing: each outage is measured on its own
