# Checkliste Antrittsvortrag 17.11.2026

Deck: `antrittsvortrag_yunus.pptx` (10 Folien) · ~5 min Vortrag, dann Diskussion · Details: `notes.md`, Quellen:
`citations.md`

## Vorher (Technik)

- [ ] Lokale PPTX ist die finale Fassung (die neue Frage zum Interventionsdesign auf Folie 7 steht nur lokal)
- [ ] Notizen zu Folie 7 passen zur neuen Frage („Open 1“ nennt noch Developer acceptance)
- [ ] In PowerPoint einmal durchklicken: Morph-Übergänge, blinkender Cursor auf Folie 2, GIF auf Folie 6 läuft
- [ ] Schriften korrekt (Google Sans, JetBrains Mono), sonst lokal installieren
- [ ] Referentenansicht an, Notizen lesbar
- [ ] Laptop am Strom, Benachrichtigungen aus, Adapter/HDMI dabei
- [ ] PDF als Notfall-Backup auf USB-Stick
- [ ] Wasser, Uhr oder Timer sichtbar

## Ablauf

| # | Folie | Zeit | Kernaussage | Nicht vergessen |
| --- | --- | --- | --- | --- |
| 1 | Titel | ~20 s | Wann sollte ein Agent anhalten und seine Arbeit zeigen? | Name, Titel, „mainly want your feedback“ |
| 2 | Looks good to me | ~20 s | Wir mergen Agent-Code schneller, als wir ihn verstehen | Homework-Beispiel einführen |
| 3 | RQ | ~40 s | Interventionen wirken, aber wann? | Over-Reliance **sinkt** (Buçinca); Intervention = Pause **+ Verhaltensfrage**; vier Subtasks |
| 4 | The agent decided for you | ~30 s | Zweite Abgabe abgelehnt: der Request sagt nichts dazu | Begriff „Request“, nicht „Story“; Definition Decision Point |
| 5 | One pause, three places | ~30 s | END · DECISION · OTHER STEP | OTHER STEP = Kontrolle; Hypothese „whole feature“ |
| 6 | Study | ~80 s | Ablauf einer Sitzung von Anfang bis Ende | Definition Verständnis: „predict what the code does … without looking at it“ |
| 7 | Recap & your thoughts | ~45 s | Problem · Idee · Studie · Stand | Übergabe: „I'd love your thoughts“, dann **schweigen** |
| 8–9 | Backups | – | Hidden script · sechs Features | nur auf Nachfrage |
| 10 | References | – | – | nicht zeigen |

## Begriffe einheitlich

- **Feature** = Einheit (sechs pro Person) · **Request** = Text mit der offenen Stelle · **Subtask** = Planschritt
- **Decision Point**, nicht „Milestone“ (alter Name in Exposé und Code)
- „User story“ nur beim Studienmaterial (Backup 8)

## Zahlen parat

- ~30 Personen, online, ~60 min, within-subjects, 6 Features (2 pro Bedingung: 1 korrekt, 1 mit Fehler)
- 4 Subtasks, genau 1 Pause pro Feature
- Code im Review: END 160–390 · DECISION 29–63 · OTHER STEP 18–86 Zeilen
- 5 Verständnisfragen mit verdecktem Code, je mit Sicherheitsrating, bewertet am echten Code
- Power (alte Simulation): 43 % pro Kontrast bei +18 Punkten, 33 % beide zusammen; N = 60 als Option
- Wu et al. 2026: 57 % wollen Pause bei Unklarheit, 65 % vor kritischem Code (n = 203)

## Die wichtigsten Antworten

- **Hypothese, warum?** Der Rest ist aus dem Request ableitbar, die Entscheidung nicht, und der Rest baut darauf auf.
  Am Ende geht sie in Hunderten Zeilen unter.
- **Agenten fragen doch nach?** Nur bei Lücken, die sie bemerken. Viele Lücken entstehen erst beim Coden. Fragen =
  vorher, Pause = prüfen, was der Code wirklich tut.
- **Wer setzt die Decision Points?** Ich, von Hand, nach festem Kriterium. Zweiter Rater oder LLM-Judge geplant,
  Detektor höchstens im Schattenmodus.
- **Warum vier Subtasks?** Agenten arbeiten mit Plänen. Pausen an Planschritten sind realistisch, die feste Zahl hält
  Positionen und Codemenge vergleichbar.
- **Gibt es einen System-Prompt?** Ja, das Drehbuch: allgemeine Regeln + Step Outline pro Feature, vom Server
  injiziert, für Teilnehmende unsichtbar.
- **Warum keine Bedingung ohne Pause?** Menge an Review fix, nur der Ort variiert. END = heutiger Standard.
- **Pause als Hinweis „schau hier“?** Jede Bedingung hat genau eine Pause, nur das Ziel unterscheidet sich.
- **Programmiersprache als Faktor?** TS-Vertrautheit erhoben, als Moderator ausgewertet. Als Faktor zu teuer.
- **Ist ein Quiz fair?** Gleiches Prinzip wie Shen & Tamkin 2026 (RCT, AI-Gruppe 17 % schlechter).

## Offen zugeben

- Decision Points von Hand gesetzt, noch nicht unabhängig geprüft
- Inhalt der Entscheidung wird erst bei der Auswertung kontrolliert (Struktur des Schritts schon vor der Pause)
- Manche offenen Fälle könnte ein Agent im Plan-Modus erfragen
- Ein Decision Point pro Feature ist eine Vereinfachung
- END vermischt Zeitpunkt und Codemenge, deshalb OTHER STEP
- Bei der Frage zum offenen Fall hat DECISION einen mechanischen Vorteil: der eigentliche Test sind Fragen zu Code, der
  nicht in der Pause war
- Power bei N = 30 knapp, Simulation vom älteren Design
- „Confidence vs. correctness“ ist H3 (Nebenhypothese), nicht rein explorativ

## Quellen: Vorsicht beim Formulieren

- **Buçinca:** misst Over-Reliance, nicht Verständnis; keine Programmieraufgabe
- **Iqbal & Bailey:** Unterbrechung umgekehrt (System unterbricht Person), Analogie
- **Wang et al.:** Positionspapier, eine Forderung, kein Beleg
- **Kravchuk-Kirilyuk:** Positionspapier
- **Mu et al.:** Motivation des Papers, nicht deren Messung

## Nach dem Vortrag

- [ ] Feedback und Fragen notieren
- [ ] `analysis-plan.md`, `expose.md`, `analyze.R`, `simulate.R` auf H1 = whole feature umstellen (+ Robustheitscheck
  ohne die Frage zum offenen Fall)
- [ ] Stories auf offene Fälle prüfen, die ein Agent vorab erfragen würde
- [ ] Decision Points validieren lassen (zweiter Rater / LLM-Judge)
