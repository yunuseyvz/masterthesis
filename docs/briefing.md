# Briefing and debriefing (experimenter script)

What the participant sees is in the study build (`study-harness/agent-ui/study/pages.tsx`, `dock.tsx`). This is the
spoken part around it. German, because the session is run in German; the interface is in English.

## Before the session

> „Du bist heute neu im Team von **Shopfront**, einem kleinen Online-Shop, als Entwickler:in. Das Team arbeitet mit
> einem KI-Coding-Agenten: Die Product Ownerin schreibt eine User Story, der Agent plant und setzt sie um, und eine
> Entwickler:in prüft die Arbeit, bevor sie rausgeht. Diese Woche bist du das.
>
> Pro Feature liest du die Story und den Plan und gibst den Plan frei. Wenn der Agent stoppt, schaust du dir den Code
> an: Änderungen, Dateien, Terminal, Tests. Dann entscheidest du: **Accept** heißt, es geht mit dem heutigen Release
> raus; **Reject** heißt, es geht zurück und das Feature wartet einen Tag.
>
> Danach hast du Rufbereitschaft für diese Features. Ein Kollege vom Support stellt dir ein paar Fragen dazu, ohne
> dass du den Code siehst. Beantworte sie aus dem, was du beim Review verstanden hast.
>
> Behandle es wie echt: Es geht um Kund:innen und Geld. Nimm dir die Zeit, die du auch bei der Arbeit nehmen würdest."

Then let them read the start page and click **Start**. Do not read the questionnaire to them.

## Questions participants ask

| Question | Answer |
|---|---|
| „Ist der Agent echt?“ | „Er läuft in dieser Umgebung. Behandle ihn wie den Agenten deines Teams.“ (The replay is revealed in the debrief, not before.) |
| „Soll ich nach Fehlern suchen?“ | „Prüfe die Arbeit so, wie du sie im Alltag prüfen würdest, und entscheide, ob sie rausgeht.“ |
| „Wie lange habe ich?“ | „So lange du brauchst. Es gibt keine Zeitvorgabe, die Sitzung dauert insgesamt etwa eine Stunde.“ |
| „Was passiert bei Accept/Reject?“ | „Accept: geht mit dem Release raus. Reject: geht zurück, das Feature wartet.“ |
| „Darf ich die Tests laufen lassen?“ | „Ja, Terminal und Tests funktionieren. Nutze, was du auch sonst nutzen würdest.“ |
| „Warum pausiert der Agent manchmal / warum schreibt er so viel auf einmal?“ | „Das gehört zur Studie. Mach einfach so weiter wie bisher.“ |

**Do not mention:** the three conditions, that pauses are placed, that some features contain a deliberate defect, that
the tests cannot catch it, or anything about the hypotheses. If asked directly whether there is a trick: „Das erkläre
ich dir am Ende, ja?“

## During the session

- Stay in the room but out of the screen; do not point at code or suggest a decision.
- If the participant is stuck on the interface: show Files, Terminal, the Changes view; do not evaluate the code.
- If a session fails (container, browser), note the participant ID and restart with the same `--group` and `--round`;
  a session that did not reach Finish wrote no data.

## Debrief (the page says it too)

> „Der Agent hat eine aufgezeichnete Sitzung abgespielt: Alle sehen denselben Code, kein Modell hat live geantwortet.
> In einigen Features steckte absichtlich ein Fehler, den die Tests nicht finden. Die Studie vergleicht, wann der
> Agent für das Review pausiert, und wie gut man den Code danach versteht und solche Fehler erkennt.“

Then: any questions, how it felt, whether the task was clear (notes for the pilot), data removal on request, thank
them.
