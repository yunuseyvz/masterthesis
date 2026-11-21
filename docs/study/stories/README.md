# Story-Blätter

Ein Blatt pro Story nach `docs/study/story-spec.md`. Die Blätter beschreiben, was in `study-harness/trials/<id>/`
steht: Story und Akzeptanzkriterien, Public Plan, Secret Plan, offener Fall, Flaw, freie Entscheidung und die Fragen
mit ihren Antworten in der Referenz. Ändert sich ein Trial, wird das Blatt mitgezogen.

| Story | Milestone | Flaw | NON-MILESTONE | Offener Fall | Flaw (widerspricht einem Kriterium) | Freie Entscheidung |
|---|---|---|---|---|---|---|
| US0 | 2 | – | – (Übung) | Wunschname nur aus Leerzeichen | – (Übung) | Doppeltes Leerzeichen im Namen |
| US1 | 2 | 2 | 1 oder 3 | 5 bestellt, 3 da | SKU bei Bestand 0 entfernt (404 statt 409) | Unbekanntes Feld im Request |
| US2 | 3 | 2 | 2 | Aufgegebenes Event wird erneut geliefert | `Math.floor` beim Umrechnen in Cent | Event-Typ `payment.refunded` |
| US3 | 2 | 3 | 3 | Limit `null` | Bulk-Operation zählt als eine | Unbekanntes Limit in den Overrides |
| US4 | 1 | 3 | 3 | Dauer ohne Einheit | Ausfälle über die Periodengrenze übersprungen | Einheit in Großbuchstaben |
| US5 | 3 | 3 | 2 | Request genau an der Fenstergrenze | Abgelehnte Requests zählen mit | Limit 0 |
| US6 | 1 | 1 | 3 | Runden von Bruchteil-Cents | 100-%-Coupon abgelehnt | Prozentwert 12,5 |

Pro Story gibt es fünf Understanding-Items, je eines pro Rolle: offener Fall (das Milestone-Item für H1),
Abhängigkeit (explorativ, weil ihr Code meist erst nach dem Milestone entsteht), Flaw, Zusammenspiel und die freie
Entscheidung. Nur das Flaw-Item hat in Correct und Flawed verschiedene
Antworten.

NON-MILESTONE pausiert nie nach einem deklarativen Schritt (nur Typen und Konstanten, `declarative` in `trial.json`),
deshalb hat nur US1 zwei Kandidaten. Damit enthält die NON-MILESTONE-Pause den Flaw-Schritt in drei Stories (US2–US4),
so oft wie die Milestone-Pause (US1, US5, US6).

## Herkunft

Wie die Stories entstanden sind, für die Thesis (Rezept: `docs/study/story-spec.md` §5). Ab jetzt wird jede Hilfe durch
ein LLM hier eingetragen: Modell, wofür, und was übernommen wurde.

| Story | Von Hand | Mit LLM | Referenzcode |
|---|---|---|---|
| US0–US6 (Stand 21.11.2026) | Plätze, Stories, offene Fälle, Flaws | DeepSeek V4.1 Flash 1017; wofür, noch einzutragen | Aus Live-Läufen des Agenten, von Hand geprüft (§5, Schritt 6) |

## Prüfung gegen das Rezept (21.11.2026)

Die sieben Stories entstanden vor den Regeln pro Item-Rolle und für die Optionen (`story-spec.md` §4). Gemessen auf
`trial.json`, die Items von US1–US6 (30). **Die Optionen sind am 21.11 überarbeitet** (37 Optionen in 16 Items):
Szenarien, richtige Antworten und ihre Position sind gleich geblieben; `understanding.ts` und die Blätter sind
nachgezogen, `npm test` prüft beide Varianten auf der Referenz. Die Tabellen unten zeigen den Stand davor.

**Die richtige Option fällt durch ihre Form auf.** Sie ist in 13 von 30 Items die eindeutig längste; zu erwarten
wären etwa 7,5 (einseitig p ≈ .02). Wer nur auf die Länge achtet, liegt also über dem Zufallsniveau.

| Befund | Items |
|---|---|
| Richtige Option eindeutig die längste | US1 1, 2, 3 · US2 3, 4, 5 · US3 2, 3, 4 · US4 4 · US5 1, 2, 3 |
| Nur die richtige Option trägt eine Begründung oder einen Zusatz | US1 1 („; 3 mugs stay in stock“), US1 3 („since a reservation is all or nothing“, verrät dazu den offenen Fall), US2 3 („, without crediting“), US3 2 („: the effective limits are only the known ones“) |
| Offensichtlich unsinnige Optionen (das Zufallsniveau sinkt) | US4 1 („1.5 (seconds)“, „5400 (hours)“) · US1 3 („Always 1“) · US1 4 („409“ für ein unbekanntes Feld) · US2 1 („6“) |

**Nach der Überarbeitung:** Die richtige Option ist in keinem Item mehr die eindeutig längste, in 5 die eindeutig
kürzeste (zu erwarten etwa 7,5), und in 18 die zweitlängste. Wer weiß, dass die längste nie stimmt, kann sie streichen
und rät dann mit 33 % statt 25 %. Bemerkt hat das bisher niemand. Der Rate-Check misst, ob es etwas ausmacht.

**Vielleicht ohne Code lösbar**, für den Rate-Check (Schritt 8). Die Flaw-Items sind in Correct ohnehin aus dem
Kriterium lösbar und fehlen hier:

| Item | Warum |
|---|---|
| US2 4 Abhängigkeit | „A temporary failure is retried“ legt den 5xx nahe |
| US4 5 Zusammenspiel | „An outage longer than the threshold“ legt nahe, dass jeder Ausfall einzeln zählt |
| US5 4 Abhängigkeit | Das dritte Kriterium und „Retry-After“ legen „Yes“ nahe |
| US3 5 Zusammenspiel | schon vorher als Kandidat genannt (`maxUsers: 0`) |

**Rolle nicht sicher erfüllt:** US5 5 (Zusammenspiel) hängt vielleicht nur von Schritt 4 ab, nämlich davon, wie das
Gateway den Client erkennt. Die Rolle verlangt zwei Schritte.

**Bewusst so gelassen (21.11):** In US2, US4 und US6 ähnelt die Verhaltensfrage zum Flaw-Schritt weiter dem Flaw-Item.
Dafür wird H1 auch ohne das Flaw-Item berichtet.

## Offen

- **Längen weiter mischen:** In etwa einem Viertel der Items sollte die richtige Option die längste sein, nicht in
  keinem. Erst nach dem Rate-Check entscheiden.
- **Herkunft:** eintragen, wofür DeepSeek V4.1 Flash 1017 bei den bestehenden Stories genutzt wurde.
- **Eval-Matrix:** Jede Story braucht mehrere Live-Läufe pro Variante. Landet der Flaw, sind alle Items gradebar,
  und streut die freie Entscheidung?
- **Bestreitbarkeits-Check:** 3–5 Personen beurteilen blind, ob Flawed und Correct der Story widersprechen.
- **Item-Audit:** Lässt sich ein Item ohne Code aus Story und Public Plan beantworten? Kandidaten: US3 Item 5
  (`maxUsers: 0`) und US4 Item 5 (zwei kurze Ausfälle).
