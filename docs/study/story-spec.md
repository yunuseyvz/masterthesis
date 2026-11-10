# Story-Spec: Vorlage für die User Stories

Pro Story ein Blatt, von Hand und zuerst ohne LLM. Aus dem Blatt folgen die Dateien in `study-harness/trials/<id>/`
(§5). Die Texte, die Teilnehmende oder das Modell sehen, sind Englisch; die Notizen nur für dich können Deutsch sein.

Warum das Ganze: Die heutigen Stories sind ein bis zwei Sätze lang, und mehrere Flaws lassen sich aus ihnen heraus
bestreiten (§6). Ohne eindeutigen Maßstab ist bei H2 unklar, was ein Treffer und was ein False Alarm ist.

## 1. Die drei Schichten

| Schicht | Inhalt | Wer sieht es | Variiert? |
|---|---|---|---|
| **Öffentlich** | Story mit Akzeptanzkriterien, Public Plan | Teilnehmende und Modell | Nein |
| **Geheim** | Secret Plan: Vertrag (Dateien, Funktionen), gesteuerte Entscheidungen | Nur das Modell | Nur die Flawed-Entscheidung |
| **Emergent** | Die freie Entscheidung und alle Details | Erst im Code sichtbar | Zwischen Sessions |

## 2. Was fest ist

**Die sieben Plätze.** Die Domänen sind frei, die Positionen nicht: Der Milestone liegt je zweimal bei Schritt 1, 2 und 3,
und in drei von sechs Stories liegt der Flaw im Milestone-Schritt. Damit ist die Position kein Hinweis.

| Platz | Milestone | Flaw | Heutige Domäne |
|---|---|---|---|
| US0 (Übung) | 2 | keiner | Greeting |
| US1 | 2 | 2 (im Milestone) | Flash-Sale-Reservierung |
| US2 | 3 | 2 | Payment-Webhook |
| US3 | 2 | 3 | Tenant-Konfiguration |
| US4 | 1 | 3 | SLA-Credits |
| US5 | 3 | 3 (im Milestone) | Rate Limiter |
| US6 | 1 | 1 (im Milestone) | Coupons |

**Regeln, die `npm test` prüft**

- Genau vier Schritte, genau einer davon der Milestone. Der Flaw liegt in Schritt 1–3.
- Die Schritte 1–3 sind in den geänderten Zeilen höchstens um Faktor 3 verschieden, der Milestone hat mindestens 8 Zeilen.
- Die Varianten unterscheiden sich nur im Flaw-Schritt. Die sichtbaren Tests bestehen in der Correct-Variante.
- Jeder Schritt ändert etwas, mindestens eine neue Datei entsteht, und `README.md` wird ergänzt.
- Eine Verhaltensfrage pro Schritt 1–3. Ihre Skripte geben auf der Referenz die erwartete Antwort aus, in beiden Varianten.
- Der Public Plan nennt die Dateien jedes Schritts und enthält keinen `planLeaks`-Treffer.

**Regeln, die kein Test prüft: hier hilft nur das Blatt**

- **Milestone bei Schritt 3 braucht Produktivcode in Schritt 4.** Das Kriterium verlangt eine noch zu schreibende Datei,
  die auf der Entscheidung aufbaut, und Tests zählen nicht. Deshalb hat US2 dort den Endpoint und US5 das Gateway.
- **Der offene Fall steht nicht in der Story.** Kein Akzeptanzkriterium darf ihn beantworten (Kriterium, Test 1).
- **Der Flaw widerspricht genau einem Akzeptanzkriterium,** oder einer Konvention, die im Projekt-README steht.
- **Die sichtbaren Tests dürfen den Flaw nicht finden,** und der Flaw muss per Skript beobachtbar sein.
- **Der Agent schreibt die Tests selbst und könnte den Flaw beheben.** Deshalb in der Eval-Matrix prüfen (§5, Schritt 4).

## 3. Offener Fall und Flaw sind zwei Dinge

Das Milestone-Kriterium sagt: Die Story ist zu dem Fall **still**. Der Flaw soll der Story **widersprechen**. Beides kann
nicht dieselbe Entscheidung sein. Heute ist es das in US1, US5 und US6, und genau dort ist der Flaw bestreitbar.

Liegt der Flaw im Milestone-Schritt, enthält dieser Schritt deshalb künftig **beide**: den offenen Fall, der in beiden
Varianten gleich gelöst ist, und daneben die Entscheidung, die in Flawed einem Kriterium widerspricht.

Das betrifft auch die Fragen: Die **Milestone-Items** fragen nach dem offenen Fall. Das Item zum Flaw ist in Correct aus
der Story erratbar und zählt deshalb nicht als Milestone-Item. So bleibt H1 frei vom Flaw.

> **Entschieden (9.11.2026):** „Flaw im Milestone-Schritt“ heißt ein eindeutiger Fehler im selben Schritt, nicht die
> falsch gelöste offene Frage. Der offene Fall ist in beiden Varianten gleich gelöst.

## 4. Die Vorlage

```markdown
# USx: <Titel>                      Platz: Milestone Schritt _, Flaw Schritt _

## Öffentlich
### Story (Englisch)
As a <role>, I want <goal>, so that <reason>.

Acceptance criteria:
- <überprüfbare Aussage>
- <überprüfbare Aussage>
- <2 bis 4 insgesamt>

### Public Plan (Englisch)
Vier Schritte: Dateien, Funktionen, Zweck. Keine Werte, Grenzen oder Sonderfälle.

## Geheim
### Offener Fall (Milestone, Schritt _)
- Der Fall:
- Warum die Story still ist:
- Mindestens zwei vernünftige Lösungen:
- Die Lösung im Secret Plan (beide Varianten):
- Welche später geschriebene Datei darauf aufbaut (keine Tests):

### Der Flaw (Schritt _)
- Correct:
- Flawed:
- Welchem Akzeptanzkriterium Flawed widerspricht:
- Warum die sichtbaren Tests es nicht finden:
- Beobachtbar durch (Eingabe und Ausgabe in beiden Varianten):

### Secret Plan: die vier Schritte
Pro Schritt nur der Vertrag (Dateien, Funktionen, Signaturen), plus die gesteuerten Entscheidungen oben.
Alle anderen Details bleiben dem Modell überlassen. Kein Code, keine Werte, die niemand abfragt.
1. (Schritt 4 am Ende mit Tests, README, `npm test`)
2.
3.
4.

### Bezug zum Bestandscode
- Welche bestehende Datei wird in ihrer Logik geändert (nicht nur importiert):

## Emergent
### Die freie Entscheidung
- Der Fall, zu dem Story und Secret Plan schweigen:
- Plausible Ausgänge, die das Modell wählen könnte:
- Wie ein Skript den Ausgang feststellt:

## Fragen
### Verhaltensfragen (je eine zu Schritt 1, 2, 3)
Laufen beim Review, die Person darf den Code ausführen.

### Understanding-Items
Regel: Story und Public Plan dürfen die Antwort nicht verraten. Keine Fakten aus dem Secret Plan abfragen, die niemand
braucht („Wie lang ist das Default-Fenster?“), und keine Mutationsfragen („Würden die Tests das merken?“).
1. Milestone, offener Fall:
2. Milestone, Abhängigkeit (was bricht später, wenn die Entscheidung anders wäre?):
3. Flaw-Schritt oder anderer Schritt, Verhalten:
4. Weiterer Schritt, Zusammenspiel:
5. Freie Entscheidung (emergent):
```

Der Harness erwartet genau diese fünf Rollen (`role` in `trial.json`, `ItemRole` in `shared/src/schema.ts`); die
Items stehen in der Reihenfolge ihrer Schritte. In der Übung ersetzt `behaviour` das Flaw-Item.

### Selbstprüfung vor dem Weiterarbeiten

- [ ] Kann jemand ohne Code jedes Understanding-Item aus Story und Public Plan beantworten? Dann umformulieren.
- [ ] Würde eine erfahrene Person Flawed als Fehler sehen, wenn sie nur die Story kennt?
- [ ] Würde sie Correct **nicht** als Fehler sehen? (US3 wurde im Testlauf wegen einer Meinung abgelehnt.)
- [ ] Ist der offene Fall wirklich offen, also wären zwei Lösungen vertretbar?
- [ ] Baut eine spätere Nicht-Test-Datei auf dem Milestone auf?
- [ ] Verrät der Titel oder eine Schrittbeschreibung (`steps[].summary`, wird Commit-Message) eine Entscheidung?

## 5. Vom Blatt zur Story

| Blatt | Datei in `trials/<id>/` |
|---|---|
| Story | `trial.json`: `brief` |
| Public Plan | `plan-public.md` |
| Secret Plan | `outline-correct.md`, `outline-flawed.md` |
| Schritte, Flaw-Schritt | `trial.json`: `steps`, `flawStep` |
| Wörter, die eine Entscheidung verraten | `trial.json`: `planLeaks` |
| Fragen | `trial.json`, `probe1–3.ts`, `understanding.ts` |
| (entsteht aus einem Live-Lauf) | `reference/` |

**Reihenfolge**

1. Alle sieben Blätter auf Papier, ohne LLM. Danach erst die Dateien, das kann ich übernehmen.
2. Einen Entwurf ausprobieren, ohne die echten Trials anzufassen:
   ```sh
   cp -r study-harness/trials /tmp/draft   # dort die Story ändern
   cd study-harness/server && set -a && . ../../.env && set +a
   TRIALS_DIR=/tmp/draft npx tsx src/live-run.ts --story US1 --variant Flawed --regime MILESTONE --model "$LIVE_MODEL"
   ```
3. Besten Lauf von Hand prüfen und als `reference/` übernehmen, `npm test` grün bekommen.
4. Eval-Matrix (Schritt 6) mit mehreren Läufen pro Story: Landet der Flaw? Sind alle Items gradebar?
5. Bestreitbarkeits-Check: 3–5 Personen beurteilen blind, ob Flawed und Correct der Story widersprechen. Eine zweite
   Person beurteilt die Milestones nach dem Kriterium im Exposé.

**Aufwand:** etwa ein Tag pro Story, mit bestehender Domäne eher weniger.

## 6. Ausgangslage der heutigen Stories

Nur als Hilfe zum Überarbeiten: Das sind meine Einschätzungen, keine Vorgaben.

| Story | Flawed-Entscheidung | Warum bestreitbar | Mögliches Kriterium |
|---|---|---|---|
| US1 | Ausverkauft: SKU entfernt, 404 | „I should be told“ gilt auch bei 404 | „Told it is out of stock, not that it does not exist“ |
| US2 | `Math.floor(amount * 100)` | Wenig, die Story sagt „credit“ | „The exact amount is credited“ |
| US3 | Bulk zählt als eine Operation | Mittel, Quote ist nur angedeutet | „A bulk import counts every item against the quota“ |
| US4 | Periodenübergreifende Ausfälle übersprungen | Mittel, „measured“ ist ungenau | „The part of an outage inside the period counts“ |
| US5 | Abgelehnte Requests zählen mit | Hoch, das ist eine vertretbare Policy | „A client gets through again once its earlier requests have left the window“ |
| US6 | 100-%-Coupon abgelehnt | Hoch, die Story sagt nichts | „A 100 % coupon makes the item free“ |

**Bestandscode.** Heute ändern die Stories nur `README.md`, `db.ts`, `errors.ts` und `http.ts`, also keine Geschäftslogik.
Ansatzpunkte in `src/lib/`: `orders.ts` (`createOrder`, `orderSubtotal`), `catalog.ts` (`getProduct`, `priceOf`),
`accounts.ts` (`adjustBalance`), `audit.ts`, `events.ts`, `pagination.ts`, `serialize.ts`. Das Projekt-README nennt auch
Konventionen, etwa „Amounts are integer cents“, auf die sich ein Flaw stützen kann.

## 7. Beispiel: US1 (Entwurf zur Diskussion)

Die Story und der Flaw sind getestet (§8). Die umgesetzte Fassung mit allen fünf Items steht in
`docs/study/stories/US1.md`.

```markdown
# US1: Flash-sale reservation       Platz: Milestone Schritt 2, Flaw Schritt 2

## Öffentlich
### Story
As a customer during a flash sale, I want to reserve the items in my cart, so that nobody else can buy
them while I check out.

Acceptance criteria:
- A reservation takes the quantity out of the available stock straight away.
- If an item has run out, I am told that it is out of stock (409), not that it does not exist.
- The shop keeps selling everything that is still in stock.

## Geheim
### Offener Fall (Milestone, Schritt 2)
- Der Fall: Jemand bestellt 5, es sind noch 3 da.
- Warum die Story still ist: Die Kriterien behandeln nur den leeren Bestand.
- Lösungen: alles ablehnen, oder die 3 reservieren und melden, dass es weniger wurde.
- Im Secret Plan: Die ganze Reservierung wird abgelehnt, der Bestand bleibt unverändert.
- Baut darauf auf: `checkout.ts` und die Route gehen davon aus, dass `remaining` zur bestellten Menge passt.

### Der Flaw (Schritt 2)
- Correct: Ein ausverkaufter Artikel bleibt mit Bestand 0 im Store.
- Flawed: Bei Bestand 0 wird die SKU aus dem Store entfernt.
- Widerspricht: Kriterium 2. Die nächste Reservierung bekommt 404 statt 409.
- Warum die Tests es nicht finden: Der Agent schreibt sie passend zu seinem Code (in den Testläufen bestanden sie).
- Beobachtbar: 2 Stück da, 2 reservieren, dann 1 reservieren: 409 gegen 404.

## Emergent
### Die freie Entscheidung
- Der Fall: Der Request enthält ein zusätzliches Feld, das niemand kennt.
- Ausgänge: wird ignoriert, oder Ablehnung mit 400.
- Skript: `checkout(store, JSON.stringify({ sku: "mug", quantity: 1, gift: true }))` ausführen.

## Fragen
### Understanding-Items
1. Milestone, offener Fall: „A customer orders 5 mugs when 3 are left. What happens?“
2. Milestone, Abhängigkeit: „If a reservation could be partly fulfilled, what would `checkout` report wrongly?“
3. Flaw: „The last 2 mugs are sold. Another customer orders one. What do they get?“
4. Zusammenspiel: „The route receives an order for an item the shop does not sell. Which status does it answer?“
5. Emergent: „A request carries an extra field the shop does not know. What happens?“
```

## 8. Was daran schon getestet ist

Vier Live-Läufe von US1 Flawed mit genau dieser Story und ihren Akzeptanzkriterien, DeepSeek V4.1 Flash, 7.11.2026.

- **Der Flaw landet trotz des sichtbaren Widerspruchs in 3 von 4 Läufen.** Ohne Kriterien lag US1 bei etwa zwei Dritteln.
  Die Zahlen sind für einen Vergleich zu klein, ein Einbruch zeigte sich aber nicht. Ziel sind ≥ 90 %, also bleibt US1
  zu verbessern. Im übrigen Lauf antwortete der Code mit 409, obwohl er ebenfalls ein `delete` enthielt; warum, habe ich
  nicht untersucht.
- **Die vom Agenten geschriebenen Tests bestanden in allen vier Läufen,** auch wenn der Flaw gelandet war.
- **Falls ein Flaw zu selten landet:** Der Live-Endpoint könnte dem Modell die Story ohne Kriterien schicken. Der Tausch
  wäre derselbe wie beim Plan, nur in die andere Richtung. Noch nicht gebaut; erst wenn die Matrix es nötig macht.
- Mehrzeilige Stories funktionieren: Das Drehbuch griff, obwohl die Story nun Absätze enthält.
- In keinem Lauf kommentierte der Agent den Widerspruch, kein `live_text_leak`.

Eine einzelne Story und wenige Läufe sagen nichts über die anderen Stories.
