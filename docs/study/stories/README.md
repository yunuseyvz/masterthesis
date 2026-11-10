# Story-Blätter

Ein Blatt pro Story nach `docs/study/story-spec.md`. Die Blätter beschreiben, was in `study-harness/trials/<id>/`
steht: Story und Akzeptanzkriterien, Public Plan, Secret Plan, offener Fall, Flaw, freie Entscheidung und die Fragen
mit ihren Antworten in der Referenz. Ändert sich ein Trial, wird das Blatt mitgezogen.

| Story | Milestone | Flaw | Offener Fall | Flaw (widerspricht einem Kriterium) | Freie Entscheidung |
|---|---|---|---|---|---|
| US0 | 2 | – | Wunschname nur aus Leerzeichen | – (Übung) | Doppeltes Leerzeichen im Namen |
| US1 | 2 | 2 | 5 bestellt, 3 da | SKU bei Bestand 0 entfernt (404 statt 409) | Unbekanntes Feld im Request |
| US2 | 3 | 2 | Aufgegebenes Event wird erneut geliefert | `Math.floor` beim Umrechnen in Cent | Event-Typ `payment.refunded` |
| US3 | 2 | 3 | Limit `null` | Bulk-Operation zählt als eine | Unbekanntes Limit in den Overrides |
| US4 | 1 | 3 | Dauer ohne Einheit | Ausfälle über die Periodengrenze übersprungen | Einheit in Großbuchstaben |
| US5 | 3 | 3 | Request genau an der Fenstergrenze | Abgelehnte Requests zählen mit | Limit 0 |
| US6 | 1 | 1 | Runden von Bruchteil-Cents | 100-%-Coupon abgelehnt | Prozentwert 12,5 |

Pro Story gibt es fünf Understanding-Items, je eines pro Rolle: offener Fall (das Milestone-Item für H1),
Abhängigkeit (explorativ, weil ihr Code meist erst nach dem Milestone entsteht), Flaw, Zusammenspiel und die freie
Entscheidung. Nur das Flaw-Item hat in Correct und Flawed verschiedene
Antworten.

## Offen

- **Eval-Matrix:** Jede Story braucht mehrere Live-Läufe pro Variante. Landet der Flaw, sind alle Items gradebar,
  und streut die freie Entscheidung?
- **Bestreitbarkeits-Check:** 3–5 Personen beurteilen blind, ob Flawed und Correct der Story widersprechen.
- **Item-Audit:** Lässt sich ein Item ohne Code aus Story und Public Plan beantworten? Kandidaten: US3 Item 5
  (`maxUsers: 0`) und US4 Item 5 (zwei kurze Ausfälle).
