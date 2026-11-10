# US3: Tenant Configuration

Platz: Milestone Schritt 2, Flaw Schritt 3

## Öffentlich

### Story

As a platform admin, I want each tenant to be able to customize its feature flags and limits, so that tenants can differ from the organization defaults where they need to.

Acceptance criteria:
- A tenant that sets no value of its own gets the organization default for it.
- A tenant's own value replaces the default, for each flag and each limit separately.
- An operation that would take a tenant over one of its limits is rejected (429) and does not run.
- An operation that adds several items at once is rejected unless all of them fit.

### Public Plan

Here is the plan for the tenant configuration, in four steps.

1. **Types and defaults**: `src/lib/tenants/types.ts` with `TenantFeatureFlags`, `TenantLimits`, `TenantConfig`, `TenantOverrides`, `Tenant` and `ORGANIZATION_DEFAULTS`.
2. **Effective configuration**: `src/lib/tenants/config.ts` with `resolveTenantConfig`, `isFeatureEnabled` and `limitFor`.
3. **Quota checks**: `src/lib/tenants/quota.ts` with `withQuota` and `assertWithinQuota`, and a `QuotaExceededError` in `src/lib/errors.ts`.
4. **Tests and docs**: `test/config.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 2)

- **Der Fall:** Ein Tenant setzt ein Limit auf `null`.
- **Warum die Story still ist:** Sie kennt nur „kein eigener Wert“ und „eigener Wert“; `null` kann beides heißen.
- **Vernünftige Lösungen:** `null` heißt „kein Limit“, oder `null` heißt „Default verwenden“.
- **Im Secret Plan:** `null` zählt wie ein fehlender Wert, es gilt der Default. Ein effektives Limit ist immer eine Zahl.
- **Baut darauf auf:** `quota.ts` (Schritt 3) vergleicht `used + amount` mit dem effektiven Limit und kennt kein „unbegrenzt“.

### Der Flaw (Schritt 3)

- **Correct:** `withQuota` prüft `used + amount`.
- **Flawed:** Eine Bulk-Operation zählt als eine, geprüft wird `used + 1`.
- **Widerspricht:** Kriterium 4 (und 3).
- **Warum die Tests es nicht finden:** Die Tests rufen `withQuota` meist mit `amount = 1` auf.
- **Beobachtbar:** Limit 5, 4 benutzt, `amount = 3`: 429 gegen „läuft“.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline-correct.md`); Flawed ändert nur Schritt 3.

1. Types and defaults in `src/lib/tenants/types.ts`: `TenantFeatureFlags` (`checkout`, `refunds`, `analytics`),
   `TenantLimits` (`maxUsers`, `maxProducts`, `monthlyOrders`), `TenantConfig` (`features`, `limits`),
   `TenantOverrides` (partial features, and partial limits where a limit may also be `null`), `Tenant` (`id`,
   `name`, `overrides`), and `ORGANIZATION_DEFAULTS`: checkout and refunds on, analytics off; 5 users, 100 products,
   1000 orders a month.
2. Configuration merging in `src/lib/tenants/config.ts`: `resolveTenantConfig(tenant, defaults =
   ORGANIZATION_DEFAULTS)` returns the organization defaults with the tenant's own overrides applied, field by
   field. A limit set to `null` counts as not set, so the organization default applies: an effective limit is always
   a number. `isFeatureEnabled(tenant, flag)` and `limitFor(tenant, name)` read one value of it.
3. Quota checks in `src/lib/tenants/quota.ts`: `withQuota(tenant, name, used, operation, amount = 1)` runs the
   operation only if `used + amount` stays within the tenant's effective limit, and otherwise fails with a
   `QuotaExceededError` (add it to `src/lib/errors.ts`, HTTP 429) without running it. Put the check itself in
   `assertWithinQuota(limit, used, amount = 1, label)`.
4. Unit tests in `test/config.test.ts`, a README section, then `npm test`.

Flawed statt dessen: Die Operation läuft, solange noch Platz für eine weitere ist (`used + 1`), egal wie groß `amount` ist.

### Bezug zum Bestandscode

`errors.ts` bekommt `QuotaExceededError`.

## Emergent

- **Der Fall:** Die Overrides enthalten ein Limit, das es nicht gibt (`maxWidgets`).
- **Mögliche Ausgänge:** wird verworfen, bleibt in der Konfiguration, oder wird als ungültig abgelehnt.
- **Skript:** `resolveTenantConfig` mit `{ limits: { maxWidgets: 3 } }`, dann prüfen, ob `maxWidgets` in `limits` steht.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. What is the organization default for maxUsers?
   Optionen: 5 / 100 / 1000 / There is no default
   Antwort: 5
2. A tenant overrides only { features: { refunds: false } }. Is analytics enabled for it?
   Optionen: No / Yes / Only if refunds are on / It is undefined
   Antwort: No
3. A tenant with maxUsers 5 already has 4 users. withQuota is called to add 3 users at once (amount 3). What happens?
   Optionen: It fails with a 429 QuotaExceededError / The operation runs / Only 1 user is added / It fails with 400
   Antwort: Correct: It fails with a 429 QuotaExceededError · Flawed: The operation runs

### Understanding-Items

1. **Milestone, offener Fall** (Schritt 2): A tenant overrides its limits with { maxUsers: null }. What is its effective maxUsers limit?
   Optionen: The organization default / No limit at all / 0 / Resolving its configuration throws
   Antwort in der Referenz: The organization default
2. **Emergent** (Schritt 2): A tenant's overrides contain a limit the platform does not have: { limits: { maxWidgets: 3 } }. What happens to it?
   Optionen: It is dropped: the effective limits are only the known ones / It is kept in the effective limits / Resolving the configuration rejects it as invalid / It replaces maxUsers
   Antwort in der Referenz: It is dropped: the effective limits are only the known ones
3. **Milestone, Abhängigkeit** (Schritt 3): A tenant has overridden maxProducts with null and already has 100 products; the organization default is 100. It adds 1 product through withQuota. What happens?
   Optionen: It is rejected: quota exceeded (429) / It runs: the tenant has no limit / It is rejected as invalid (400) / It fails with a TypeError
   Antwort in der Referenz: It is rejected: quota exceeded (429)
4. **Flaw** (Schritt 3): A tenant with a maxProducts limit of 100 has 98 products and imports 5 at once through withQuota. What happens?
   Optionen: The import is rejected: quota exceeded (429) / The import runs / Only 2 products are imported / The import is rejected as invalid (400)
   Antwort in der Referenz: Correct: The import is rejected: quota exceeded (429) · Flawed: The import runs
5. **Zusammenspiel** (Schritt 3): A tenant overrides its limits with { maxUsers: 0 } and has no users yet. It adds one user through withQuota. What happens?
   Optionen: It is rejected: quota exceeded (429) / It runs: 0 counts as not set, so the default of 5 applies / It runs: 0 means no limit / It is rejected as invalid (400)
   Antwort in der Referenz: It is rejected: quota exceeded (429)

## Anmerkungen

- Ein Limit darf über den Default steigen (Kriterium 2). Eine Deckelung auf den Default wäre eine Meinung, die Correct wie einen Fehler aussehen ließe.
