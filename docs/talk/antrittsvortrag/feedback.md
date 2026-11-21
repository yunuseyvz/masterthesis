# Feedback Antrittsvortrag 17.11.2026

Rohnotizen, wie mitgeschrieben, darunter geordnet und reflektiert. Deutungen sind als solche markiert.

## Rohnotizen

**Prof. Schmidt**

- developer acceptance!
- how to make devs want to use it
- fundamentals. what makes software engineering?
- mismatch
- competitive environment
- is it needed (in 5 years?)
- engage with code
- what to control, what to handoff

**Supervisor**

- the question design
- abstraction level of questions
- direct code questions on the code? smth like "here I wrote some tests", questions about these? higher abstraction
  level?

## Geordnet

Die beiden Blöcke fragen auf verschiedenen Ebenen. Prof. Schmidt fragt nach dem **Warum und Für wen**: Würde das
jemand nutzen, und welche Rolle hat der Mensch überhaupt noch? Der Supervisor fragt nach dem **Wie genau**: Welche
Frage steht in der Pause? Beide laufen auf dieselbe Frage hinaus: **Womit soll sich der Mensch in der Pause
beschäftigen: mit Codezeilen, mit Tests oder mit Entscheidungen?**

### A · Akzeptanz (Prof. Schmidt)

- **Developer acceptance! / how to make devs want to use it:** Das Ausrufezeichen ist deutlich: Wirksamkeit allein
  reicht nicht, die Pause muss gewollt sein. Den Punkt hatte ich selbst als offene Frage auf Folie 7 gestellt, er
  wurde also bestätigt und verstärkt.
- **Competitive environment:** Unter Zeit- und Produktivitätsdruck ist jede Pause ein Nachteil gegenüber Kollegen
  oder Teams, die durchwinken. Wer freiwillig pausiert, ist erst mal langsamer. Passt zu Powers 2018 (Hard Stops
  werden umgangen) und Yu 2026 (Freigaben werden Gewohnheit).
- **Mismatch** (geklärt 18.11): die Lücke zwischen Tempo und Verständnis. Was Entwickler wollen (schnell
  durchkommen) und was ihnen hilft (den Code verstehen), fällt auseinander. Die Pause sitzt genau in dieser Lücke.

**Reflexion:** Die Pause muss sich als Gewinn verkaufen, nicht als Kontrolle. Das stärkste Argument im
Wettbewerbsumfeld ist Kosten gegen Nutzen: Wie viele Sekunden kostet die Pause, und wie viele Fehler fängt sie, die
sonst später teurer wären? Dazu kommt ein Argument, das für meinen Ansatz spricht: Eine gezielte Pause an einer
begründeten Stelle ist eher akzeptabel als häufige oder zufällige. Beides gehört in die Discussion, nicht in eine
eigene Hypothese (siehe unten).

### B · Rolle des Menschen und Relevanz (Prof. Schmidt)

- **Fundamentals. What makes software engineering?** Mit dem Zusatz klarer: Was ist der Kern von Software
  Engineering, wenn Agenten den Code schreiben? Code tippen, Code verstehen, spezifizieren, entscheiden,
  verantworten?
- **Is it needed (in 5 years?):** Wenn Agenten besser werden und kaum noch jemand Code liest, braucht es dann
  Codeverständnis überhaupt?
- **Engage with code** (Deutung offen): Entweder als Ziel (Entwickler sollen sich wieder mit Code beschäftigen) oder
  als Rückfrage (ist Code überhaupt noch das richtige Objekt?).
- **What to control, what to handoff:** Die Grenze der Delegation: Was gibt der Mensch ab, was behält er?

**Reflexion:** Diese vier Punkte sind eine einzige Frage, und sie ist die wichtigste für die Positionierung der
Arbeit. Die Antwort, die mein Design schon nahelegt: Abgegeben wird das Schreiben von Code, behalten wird das
Entscheiden. Ein Decision Point ist genau die Stelle, an der der Agent etwas entschieden hat, das dem Menschen
gehört (der Request ließ es offen). Die Pause ist dann kein Code-Review, sondern ein **Moment, in dem Kontrolle
zurückgegeben wird**. Das beantwortet auch „in 5 years“: Selbst wenn niemand mehr Zeilen liest, bleiben offene Fälle
in Anforderungen und die Verantwortung für sie beim Menschen (Rahman 2026: menschlicher Owner wird verlangt).

Theoretische Grundlage dafür, die bisher fehlt: Levels of Automation (Parasuraman, Sheridan & Wickens 2000) und
Mixed-Initiative Interaction (Horvitz 1999). Beide fragen genau „what to control, what to hand off“.

Vorsicht: Wenn ich so argumentiere, misst die Studie aber Codeverständnis („was tut der Code bei Eingabe X“). Das
passt, solange Verständnis als „Verständnis des Verhaltens“ definiert ist, nicht als Verständnis von Zeilen. Diese
Definition steht schon im Skript („predict what the code does in the cases that matter“) und sollte im Exposé
explizit werden.

### C · Design der Frage in der Pause (Supervisor)

- **The question design / abstraction level of questions:** Auf welcher Ebene fragt die Pause?
- **Direct code questions? Tests?** Konkreter Vorschlag: „Hier habe ich Tests geschrieben, Fragen dazu“, statt
  oder neben einer Frage auf höherer Ebene.

Mögliche Ebenen, von konkret nach abstrakt:

| Ebene | Beispiel | Bisher |
| --- | --- | --- |
| Codezeile | „Was macht Zeile 42?“ | nein |
| Tests | „Welche dieser Tests laufen durch?“ / „Welcher Fall fehlt in den Tests?“ | nein |
| Verhalten | „Was passiert, wenn ein Student zweimal abgibt?“ (ausführbar) | **ja** |
| Entscheidung | „Welche Regel hat der Agent für X gewählt?“ | indirekt |
| Absicht | „Passt das zu den Acceptance Criteria?“ | nein |

**Reflexion:** Die Ebene bestimmt, was trainiert und was gemessen wird. Je näher die Pausenfrage an den
Verständnisfragen danach liegt, desto eher misst die Studie „Frage schon mal gesehen“ statt Verständnis. Das spricht
für die geplante Regel: eine Frage zum gerade fertigen Teilschritt, gleich gebaut in allen Bedingungen.

Die Test-Idee ist interessant, weil sie zu Block B passt: Tests sind die Schnittstelle zwischen Absicht und Code.
Sie sind das Artefakt, über das man Kontrolle behält, ohne jede Zeile zu lesen. Und sie sind realistisch: Agenten
schreiben Tests, Entwickler überfliegen sie. Risiko: Am Decision Point zeigt eine Testfrage den offenen Fall sehr
direkt und ist damit stärker als in den anderen Bedingungen.

Empfehlung: Für die Hauptstudie bei der Verhaltensfrage bleiben (Harness ist fertig, Pilot steht an) und die Ebene
explizit begründen: Verhaltensebene, zwischen Trace-and-Predict und Annahmenfragen
(`intervention-landscape.md`), passend zur Definition von Verständnis. Tests als Pausenform in Future Work, ggf.
eine Testfrage im Pilot ausprobieren.

## Entscheidung (20.11.2026)

Prof. Schmidts Feedback wird zur Kenntnis genommen und in die Discussion eingebracht. Die Studie wird nicht danach
umgebaut: keine Hypothese zur Akzeptanz, kein Zeitdruck als Faktor, keine Kosten-Nutzen-Auswertung. Das Design
steuert der Supervisor, siehe `docs/study/meeting-2026-11-19.md`. Block C (Pausenfrage) geht dort weiter.

## Für die Discussion

1. **Akzeptanz.** In der Studie ist die Pause Pflicht, damit die Bedingungen vergleichbar sind. Ob Entwickler sie
   freiwillig nutzen würden, bleibt offen, vor allem unter Wettbewerbsdruck. Bezug: Powers 2018 (Hard Stops werden
   umgangen), Yu 2026 (Freigaben werden Gewohnheit), Wu 2026 (57 % / 65 % wollen gezielte Pausen). Eine gezielte
   Pause an einer begründeten Stelle ist eher akzeptabel als häufige.
2. **Tempo vs. Verständnis (Mismatch).** Die Pause kostet Zeit und soll Verständnis bringen. Das feste Review-Budget
   der Studie sagt nichts darüber, wie viel Zeit Entwickler freiwillig investieren würden.
3. **Rolle des Menschen.** Code abgeben, Entscheidungen behalten: Ein Decision Point ist die Stelle, an der der
   Agent etwas entschieden hat, das dem Menschen gehört. Das ist die Antwort auf „is it needed in 5 years?“
   (Rahman 2026: menschlicher Owner wird verlangt; Gegenposition Monperrus 2026). Grundlage: Levels of Automation
   (Parasuraman, Sheridan & Wickens 2000), Mixed Initiative (Horvitz 1999). Diese Frage hat auch der Supervisor
   gestellt („what does software engineering mean in the age of AI?“). Sie ist deshalb auch der Rahmen für die
   Einleitung.

## Offen

- [x] „Mismatch“ klären: Lücke zwischen Tempo und Verständnis (18.11)
- [ ] „Engage with code“ klären (für die Discussion, nicht dringend)
- [x] ~~Akzeptanz-Items in den Post-Survey~~: nicht wegen Schmidt; Fragen nach jeder Condition kommen vom
      Supervisor (`docs/study/meeting-2026-11-19.md`)
- [ ] Rahmen „what to control, what to hand off“ in Einleitung und Discussion aufnehmen
