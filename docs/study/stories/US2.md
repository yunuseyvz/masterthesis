# US2: Payment Webhook

Platz: Milestone Schritt 3, Flaw Schritt 2

## Öffentlich

### Story

As a payments engineer, I want the webhook endpoint to credit a customer's account when a payment event arrives, so that customers see their balance update. The payment provider may deliver the same event more than once, and processing can fail temporarily.

Acceptance criteria:
- The account is credited with exactly the amount the customer paid, to the cent.
- An event that is delivered more than once credits the account only once.
- A temporary failure is retried; an invalid event is rejected and never credited.

### Public Plan

Here is the plan for the payment webhook, in four steps.

1. **Types**: `src/lib/webhooks/types.ts` with `PaymentEvent`, `ProcessedStatus`, `EventLog` and `WebhookDeps`, the contract the other steps share.
2. **Parsing and crediting**: `src/lib/webhooks/handlers.ts` with `parsePaymentEvent`, `dollarsToCents` and `applyPayment`.
3. **Processing an event**: `src/lib/webhooks/idempotency.ts` with `processEventOnce`, for redeliveries and temporary failures.
4. **Endpoint, tests and docs**: `handleWebhookRequest` in `src/lib/webhooks/webhook.ts`, the route in `src/app/api/webhooks/payments/route.ts`, `createEventLog` in `src/lib/db.ts`, `test/webhook.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 3)

- **Der Fall:** Ein Event scheitert endgültig, und der Provider liefert es später erneut.
- **Warum die Story still ist:** „Only once“ sagt nicht, ob ein gescheiterter Versuch schon zählt.
- **Vernünftige Lösungen:** neu verarbeiten (gutgeschrieben wurde ja nichts), oder als Duplikat ignorieren.
- **Im Secret Plan:** `failed` darf erneut laufen, `processing` und `processed` sind Duplikate.
- **Baut darauf auf:** `webhook.ts` (Schritt 4) antwortet nach endgültigem Scheitern mit 500, damit der Provider erneut liefert. Das ergibt nur Sinn, weil die neue Lieferung verarbeitet wird.

### Der Flaw (Schritt 2)

- **Correct:** `dollarsToCents` rechnet exakt aus den Ziffern des Strings.
- **Flawed:** Gutgeschrieben wird `Math.floor(Number(amount) * 100)`.
- **Widerspricht:** Kriterium 1.
- **Warum die Tests es nicht finden:** Testbeträge wie `"15.00"` gehen auch mit Fließkomma auf.
- **Beobachtbar:** `"19.99"` ergibt 1999 gegen 1998.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline-correct.md`); Flawed ändert nur Schritt 2.

1. Types in `src/lib/webhooks/types.ts`: the `PaymentEvent` the provider sends (`id`, `type: "payment.succeeded"`,
   `accountId`, and `amount: string`, in dollars, e.g. "15.00"); `type ProcessedStatus = "processing" | "processed" |
   "failed";`; an `EventLog` that records each event's status and attempt count (`get`, `start`, `succeed`, `fail`);
   and `WebhookDeps` (`accounts`, `log`, `clock`, optional `maxAttempts`).
2. Event parsing and the credit handler in `src/lib/webhooks/handlers.ts`: `parsePaymentEvent(raw)` validates an
   incoming event; `applyPayment(deps, event)` credits the account through `adjustBalance` in `src/lib/accounts.ts`.
   The provider sends the amount as a decimal string in dollars, such as `"15.00"`; convert it to integer cents
   exactly, from the digits of the string (`dollarsToCents`), never through floating point.
3. Deduplication and retry in `src/lib/webhooks/idempotency.ts`:
   `processEventOnce(deps, event, handler = applyPayment, wait = sleep)` processes each event at most once even when
   the provider delivers it again (a `processing` or `processed` event is a duplicate; a `failed` one may run again),
   and retries a temporary failure, 3 attempts in total by default; an `AppError` is permanent and is not retried.
4. The webhook endpoint: `handleWebhookRequest(request, deps)` in `src/lib/webhooks/webhook.ts` turns a delivery into
   a response (200 for a duplicate; when processing still fails after all attempts, 500, so that the provider
   delivers the event again), and a `POST` route in `src/app/api/webhooks/payments/route.ts` calls it; the event log as
   `export function createEventLog(clock)` in `src/lib/db.ts` (not in the types file). Unit tests in
   `test/webhook.test.ts`, a README section, then `npm test`.

Flawed statt dessen: Der Betrag wird als Zahl gelesen, mit 100 multipliziert und abgerundet (`Math.floor`).

### Bezug zum Bestandscode

`accounts.ts` (`adjustBalance`) wird aufgerufen, `db.ts` bekommt das Event-Log.

## Emergent

- **Der Fall:** Ein Event vom Typ `"payment.refunded"`.
- **Mögliche Ausgänge:** 400 als ungültig, 200 und ignorieren, oder sogar eine Abbuchung.
- **Skript:** `handleWebhookRequest` mit diesem Event, Status und Kontostand.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. Which statuses can an entry in the event log have?
   Optionen: processing, processed or failed / processed or failed / pending, done or error / Any text
   Antwort: processing, processed or failed
2. A payment event with the amount "19.99" is applied to an account with a balance of 0. What is the balance afterwards, in cents?
   Optionen: 1999 / 1998 / 2000 / 19
   Antwort: Correct: 1999 · Flawed: 1998
3. The same payment event is delivered twice and both deliveries are processed. How many times is the account credited?
   Optionen: Once / Twice / Never / Three times
   Antwort: Once

### Understanding-Items

1. **Flaw** (Schritt 2): Three payments of "0.29", "4.35" and "1.15" are applied to an account with a balance of 0. What is its balance in cents?
   Optionen: 579 / 576 / 580 / 6
   Antwort in der Referenz: Correct: 579 · Flawed: 576
2. **Milestone, offener Fall** (Schritt 3): Processing an event fails temporarily on every attempt, so it is given up. Later the provider delivers the same event again, and now processing works. What happens?
   Optionen: It is processed again and the account is credited / It is ignored as a duplicate: the account is never credited / It is rejected as a conflict (409) / The account is credited twice
   Antwort in der Referenz: It is processed again and the account is credited
3. **Zusammenspiel** (Schritt 3): A second delivery of an event arrives while the first delivery is still being processed. What happens to the second?
   Optionen: It is accepted as a duplicate, without crediting / It credits the account as well / It waits for the first and then credits again / It fails with an error
   Antwort in der Referenz: It is accepted as a duplicate, without crediting
4. **Milestone, Abhängigkeit** (Schritt 4): A delivery reaches the webhook endpoint, but processing it fails temporarily on every attempt. What does the endpoint answer?
   Optionen: An error status (5xx), so the provider delivers it again and it is tried anew / 200, so the provider stops and the payment is never credited / 409: rejected as a conflict / 400: rejected as invalid
   Antwort in der Referenz: An error status (5xx), so the provider delivers it again and it is tried anew
5. **Emergent** (Schritt 4): The provider sends the webhook endpoint an event of type "payment.refunded". What does the endpoint answer?
   Optionen: 400: rejected as an invalid event / 200: accepted and ignored / 200: the account is debited / 500: server error
   Antwort in der Referenz: 400: rejected as an invalid event
