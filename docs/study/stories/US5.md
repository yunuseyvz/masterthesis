# US5: API Rate Limiter

Platz: Milestone Schritt 3, Flaw Schritt 3 (im Milestone)

## Öffentlich

### Story

As an API owner, I want each client limited to a number of requests per minute, so that no single client can overload the gateway.

Acceptance criteria:
- A client that is over its limit gets 429 with a Retry-After header, and its request is not handled.
- Clients are limited separately: one client over its limit does not slow down another.
- A client gets through again as soon as its earlier accepted requests have left the one-minute window, even if it kept retrying in the meantime.

### Public Plan

Here is the plan for the rate limiter, in four steps.

1. **Types and defaults**: `src/lib/ratelimit/types.ts` with `WINDOW_MS`, `RATE_LIMIT_PER_MINUTE`, `ClientHistory`, `RateLimitOptions` and `RateLimitDecision`.
2. **Clients and responses**: `src/lib/ratelimit/respond.ts` with `clientId` and `rejection`, and a `tooManyRequests` helper in `src/lib/http.ts`.
3. **The limiter**: `src/lib/ratelimit/limiter.ts` with `createLimiter`, the sliding-window check.
4. **Gateway, tests and docs**: `rateLimited` in `src/lib/ratelimit/gateway.ts`, `test/limiter.test.ts` and a section in `README.md`, then `npm test`.

## Geheim

### Offener Fall (Milestone, Schritt 3)

- **Der Fall:** Ein Request kommt genau `windowMs` nach dem ältesten gezählten.
- **Warum die Story still ist:** „Left the window“ sagt nicht, ob die Grenze dazugehört.
- **Vernünftige Lösungen:** Der alte Request zählt noch (Fenster inklusiv), oder er zählt nicht mehr (exklusiv).
- **Im Secret Plan:** Ein Request, der genau `windowMs` alt ist, zählt nicht mehr; `retryAfterMs` ist die Zeit, bis der älteste gezählte Request so alt ist.
- **Baut darauf auf:** `gateway.ts` (Schritt 4) gibt `retryAfterMs` an die Antwort mit `Retry-After` in ganzen Sekunden, aufgerundet. Wer genau so lange wartet, kommt durch, weil die Grenze exklusiv ist.

### Der Flaw (Schritt 3)

- **Correct:** Abgelehnte Requests werden nicht gezählt.
- **Flawed:** Jeder Request wird gezählt, auch abgelehnte.
- **Widerspricht:** Kriterium 3.
- **Warum die Tests es nicht finden:** Die Tests schicken selten weiter, nachdem das Limit erreicht ist.
- **Beobachtbar:** Limit 2 pro 1000 ms, 2 Requests bei 0, abgelehnte bei 100 und 200, dann einer bei 1000: erlaubt gegen abgelehnt.

### Secret Plan

Correct-Variante, wie das Modell sie bekommt (`outline-correct.md`); Flawed ändert nur Schritt 3.

1. Types and the default configuration in `src/lib/ratelimit/types.ts`: `WINDOW_MS = 60_000`,
   `RATE_LIMIT_PER_MINUTE = 60`, the per-client request history (`ClientHistory`: `clientId`, `timestamps`),
   `RateLimitOptions` (optional `limit` and `windowMs`) and `RateLimitDecision` (`{ allowed: true }` or
   `{ allowed: false, retryAfterMs }`).
2. Client identification and the response in `src/lib/ratelimit/respond.ts`: `clientId(request)` is the first
   address in `x-forwarded-for`, otherwise `x-real-ip`, otherwise `"unknown"`; `rejection(retryAfterMs)` is a
   `429 Too Many Requests` response with a `Retry-After` header in whole seconds, rounded up (add a
   `tooManyRequests` helper for it to `src/lib/http.ts`).
3. The sliding-window check in `src/lib/ratelimit/limiter.ts`: `createLimiter(clock, options)` returns
   `{ check(clientId), reset() }`. `check` counts the client's requests of the last `windowMs`, where a request
   exactly `windowMs` old has already left the window; `retryAfterMs` is the time until the oldest counted request
   leaves it. A request is allowed
   when there are fewer than `limit` of them, and is then recorded. A rejected request is not recorded: it does not
   count against the client.
4. The gateway filter `rateLimited(handler, limiter)` in `src/lib/ratelimit/gateway.ts`, which applies the check to a
   request handler (with a default limiter when none is given), unit tests in
   `test/limiter.test.ts`, a README section, then `npm test`.

Flawed statt dessen: Jeder Request kommt in die Historie, erlaubt oder abgelehnt, sodass ein Client, der weiter sendet, für alle Requests zählt.

### Bezug zum Bestandscode

`http.ts` bekommt `tooManyRequests`.

## Emergent

- **Der Fall:** Ein Limiter mit Limit 0.
- **Mögliche Ausgänge:** alles abgelehnt, auf 1 angehoben, alles erlaubt, oder ein Fehler beim Erzeugen.
- **Skript:** `createLimiter(clock, { limit: 0 })`, dann zwei Requests prüfen.

## Fragen

### Verhaltensfragen (je eine zu Schritt 1, 2, 3)

1. How many requests per minute does a client get by default?
   Optionen: 60 / 100 / 10 / 1000
   Antwort: 60
2. A request has the headers x-forwarded-for: "10.0.0.1, 10.0.0.2" and x-real-ip: "10.0.0.9". Which client id does it get?
   Optionen: 10.0.0.1 / 10.0.0.2 / 10.0.0.9 / unknown
   Antwort: 10.0.0.1
3. A limiter allows 2 requests per 1000 ms. A client sends 2 requests at 0 ms, 2 more at 100 ms and 200 ms (both rejected), then one at 1000 ms. Is the last one allowed?
   Optionen: Allowed / Rejected / Allowed only after a reset / It throws
   Antwort: Correct: Allowed · Flawed: Rejected

### Understanding-Items

1. **Milestone, offener Fall** (Schritt 3): A limiter allows 2 requests per 1000 ms. Requests at 0 ms and 500 ms are allowed. Is a request at exactly 1000 ms allowed?
   Optionen: Allowed: the request from 0 ms no longer counts / Rejected: the request from 0 ms still counts / Allowed only after the limiter is reset / Checking it throws
   Antwort in der Referenz: Allowed: the request from 0 ms no longer counts
2. **Flaw** (Schritt 3): A client is over its limit and keeps retrying every 100 ms. When does it get through again?
   Optionen: Once its oldest accepted request has left the window / Only after it stops retrying for a full window / On its very next request / Never, until the server restarts
   Antwort in der Referenz: Correct: Once its oldest accepted request has left the window · Flawed: Only after it stops retrying for a full window
3. **Emergent** (Schritt 3): A limiter is created with a limit of 0. What happens when a client sends requests?
   Optionen: The first request is allowed, the ones after it are rejected / Every request is rejected / Every request is allowed / Creating the limiter fails with a validation error
   Antwort in der Referenz: The first request is allowed, the ones after it are rejected
4. **Milestone, Abhängigkeit** (Schritt 4): Through the gateway, a client is rejected. It then waits exactly as long as its Retry-After header says, sending nothing in between. Does its next request get through?
   Optionen: Yes / No: it is rejected again / Only if no other client sent a request meanwhile / The rejection has no Retry-After header
   Antwort in der Referenz: Yes
5. **Zusammenspiel** (Schritt 4): Two different clients send requests through the gateway, neither with any proxy header. Are they limited separately?
   Optionen: No: both count as the same client ("unknown") / Yes: each one is limited on its own / Neither of them is limited / The gateway rejects requests without proxy headers
   Antwort in der Referenz: No: both count as the same client ("unknown")
