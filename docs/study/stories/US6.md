# US6: Coupons

Platz: Milestone Schritt 1, Flaw Schritt 1 (im Milestone)

## Öffentlich

### Story

As a shopper, I want to apply a coupon to my order, so that I pay the discounted price.

Acceptance criteria:
- A percentage coupon takes that share off the order; a fixed coupon takes off a fixed amount.
- A coupon never makes an order cost less than nothing.
- A 100 % coupon makes the order free.
- A percentage coupon above 100 % is rejected as invalid.

### Public Plan

Here is the plan for the coupons, in four steps.

1. **The discount**: `src/lib/pricing/pricing.ts` with `discountFor`, which works out a coupon's discount on an amount.
2. **Types**: `src/lib/pricing/types.ts` with `CouponKind`, `Coupon`, `OrderItem` and `OrderSummary`.
3. **The order summary**: `src/lib/pricing/order.ts` with `summarizeOrder`, which totals an order and applies the coupon.
4. **Tests and docs**: `test/pricing.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 1)

- **Der Fall:** Der Prozentrabatt ergibt Bruchteile eines Cents (15 % von 999 = 149,85).
- **Warum die Story still ist:** Sie spricht nicht vom Runden; das README sagt nur „integer cents“.
- **Vernünftige Lösungen:** kaufmännisch runden, zugunsten des Shops abrunden, oder zugunsten der Kundschaft aufrunden.
- **Im Secret Plan:** auf den nächsten Cent runden.
- **Baut darauf auf:** `order.ts` (Schritt 3) wendet den Coupon einmal auf das Subtotal an, nicht pro Artikel.

### Der Flaw (Schritt 1)

- **Correct:** 0 bis 100 % sind gültig.
- **Flawed:** Ab 100 % wird der Coupon abgelehnt.
- **Widerspricht:** Kriterium 3.
- **Warum die Tests es nicht finden:** Testcoupons haben meist 10 % oder 20 %.
- **Beobachtbar:** 100-%-Coupon auf 1200 Cent: Rabatt 1200 gegen `ValidationError`.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline-correct.md`); Flawed ändert nur Schritt 1.

1. Discount calculation in `src/lib/pricing/pricing.ts`: `discountFor(amountCents, coupon)` with a coupon of
   `kind` `"percentage"` or `"fixed"` and a `value`. A percentage coupon takes that share of the amount, rounded to
   the nearest cent; values from 0 to 100 are valid, above 100 it throws a `ValidationError` ("percentage coupon
   cannot exceed 100"). A fixed coupon is an integer number of cents. The discount never exceeds the amount.
2. Types in `src/lib/pricing/types.ts`: `type CouponKind = "percentage" | "fixed";`, `Coupon` (`code`, `kind`,
   `value`), `OrderItem` and `OrderSummary` (`items`, `subtotalCents`, `discountCents`, `totalCents`, `coupon?`);
   `discountFor` takes a `Coupon`.
3. The order summary calculator in `src/lib/pricing/order.ts`: `summarizeOrder(catalog, order, coupon?)` totals the
   order's items (with `getProduct` and `orderSubtotal` from the existing modules) and applies the coupon once, to the
   subtotal, not to each item.
4. Unit tests in `test/pricing.test.ts`, a README section, then `npm test`.

Flawed statt dessen: Werte unter 100 sind gültig, ab 100 wirft `discountFor` einen `ValidationError`: Ein Coupon darf einen Preis senken, aber nichts kostenlos machen.

### Bezug zum Bestandscode

`catalog.ts` (`getProduct`) und `orders.ts` (`orderSubtotal`) werden genutzt.

## Emergent

- **Der Fall:** Ein Prozentcoupon mit Bruchwert, 12,5 %.
- **Mögliche Ausgänge:** wird angewendet, oder als ungültig abgelehnt.
- **Skript:** `discountFor(1000, { code: "X", kind: "percentage", value: 12.5 })`.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. A shopper applies a 100% coupon to a mug that costs 1200 cents. What discount does discountFor give?
   Optionen: 1200 / It throws: the coupon cannot exceed 100 / 0 / 1188
   Antwort: Correct: 1200 · Flawed: It throws: the coupon cannot exceed 100
2. Which coupon kinds exist?
   Optionen: percentage and fixed / percentage only / percentage, fixed and free shipping / Any text
   Antwort: percentage and fixed
3. An order has 2 mugs at 1200 cents and a fixed coupon of 3000 cents. What is the total?
   Optionen: 0 / -600 / 2400 / It throws
   Antwort: 0

### Understanding-Items

1. **Milestone, offener Fall** (Schritt 1): A 15% coupon is applied to an amount of 999 cents. What discount does discountFor give?
   Optionen: 150 / 149 / 149.85 / It throws
   Antwort in der Referenz: 150
2. **Flaw** (Schritt 1): An order of 2 mugs (2400 cents) gets a 100% coupon. What is the order's total?
   Optionen: 0 / It is rejected as an invalid coupon / 2400 / -2400
   Antwort in der Referenz: Correct: 0 · Flawed: It is rejected as an invalid coupon
3. **Emergent** (Schritt 1): A percentage coupon has the value 12.5. What discount does discountFor give on 1000 cents?
   Optionen: 125 / It is rejected as an invalid coupon / 120 / 130
   Antwort in der Referenz: 125
4. **Milestone, Abhängigkeit** (Schritt 3): An order has three different items at 333 cents each and a 10% coupon. What is the total?
   Optionen: 899 / 900 / 899.1 / 901
   Antwort in der Referenz: 899
5. **Zusammenspiel** (Schritt 3): An order contains an item the catalog does not have. What does summarizeOrder do?
   Optionen: It throws a NotFoundError (404) / It skips the item / It counts the item as 0 cents / It throws a ValidationError (400)
   Antwort in der Referenz: It throws a NotFoundError (404)
