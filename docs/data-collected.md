# Welche Daten erhoben werden

Überblick über alles, was eine Sitzung produziert: was Teilnehmende **direkt** angeben oder entscheiden, was
**indirekt** als Telemetrie anfällt, und was daraus berechnet wird. Die vollständige technische Referenz ist
[telemetry.md](telemetry.md); hier geht es um das *Was* und *Wofür*.

## Kurzfassung

| Direkt (bewusste Angabe/Entscheidung) | Indirekt (Telemetrie) | Roh |
|---|---|---|
| Einwilligung, Demografie | Zeit pro Phase und pro Frage | Event-Log (jedes Ereignis mit Zeitstempel) |
| NCS-6, Attention-Check, S-TIAS | Review-Dauer, Scroll-Abdeckung, Dateien, Hunks | Bildschirmaufnahme (rrweb) |
| Plan freigeben, Accept/Reject, Umentscheiden | Code auf dem Bildschirm (Datei/Zeile, ≥ 1 s) | Agent-Ereignisse von opencode |
| Verhaltensfrage (Antwort, richtig/falsch) | Flaw-Region gesehen, Terminal-Befehle, Testläufe | |
| 4 Verständnisfragen + Konfidenz | Fokus, Idle, Chat-Scroll, Tool-Aufklappen, Klicks | |
| Paas (mentaler Aufwand) | | |
| Präferenz-Ranking, Kommentar | | |

Alles Indirekte wird ohne zusätzliche Eingabe der Person erfasst. Es gibt **keine Kamera, kein Mikrofon und keine
Aufnahme außerhalb des Studienfensters**.

## 1. Direkt erhoben

### 1.1 Vor der ersten Story

| Was | Format | Zweck |
|---|---|---|
| Einwilligung | ja | Ethik |
| Altersgruppe | 18–24 … 55+, „keine Angabe“ | Kontrolle/Deskription |
| Programmiererfahrung | < 1 … 10+ Jahre | Kontrolle |
| Nutzung von KI-Assistenten | nie … täglich | Kontrolle |
| Häufigkeit von Code-Review | nie … täglich | Kontrolle |
| TypeScript-Vertrautheit | 1–5 | Kontrolle |
| NCS-6 (Need for Cognition) | 6 Items, 1–5 (Items 3–4 umgekehrt gepolt) | Kovariate, Mittelwert |
| Attention-Check | 1 Item, 1–5; bestanden bei 4 | Datenqualität |
| S-TIAS (Vertrauen in KI-Assistenten) | 3 Items, 1–7 | Kovariate, Mittelwert |
| Dauer des Fragebogens | ms | Deskription |

### 1.2 Pro Story (auch Practice, dort separat gespeichert)

Die Studie hat **eine** Forschungsfrage: Verstehen und Beurteilen des Codes. Das Verständnis ist das Hauptmaß, Fehlererkennung, Kalibrierung und Reversals sind sekundäre Maße (siehe Exposé).

| Was | Format | Zweck |
|---|---|---|
| Plan freigegeben | Aktion + Zeit seit Anzeige (`planMs`) | Aufmerksamkeit für den Plan |
| Erste Entscheidung | Accept / Reject | **Sekundärmaß**, Fehlererkennung |
| Verhaltensfrage | Antwortoption (0–3) oder „weiß nicht“ (−1) | **Sekundärmaß**, Entscheidungsgrundlage |
| Antwort richtig? | vom Server durch Ausführen des Codes geprüft | **Sekundärmaß**, Fehlererkennung |
| Zeit bis zur Antwort | ms | **Sekundärmaß**, Aufwand |
| Endgültige Entscheidung | bestätigt / umgedreht | **Sekundärmaß**, Reversals |
| 4 Verständnisfragen | je Antwort, richtig/falsch | **Hauptmaß**, Verständnis |
| Konfidenz je Frage | 50–100 % in 10er-Schritten | **Sekundärmaß**, Kalibrierung |
| Zeit je Frage | ms, summiert über Besuche | **Deskriptiv**, Aufwand |
| Antwortänderungen je Frage | Anzahl | **Deskriptiv**, Unsicherheit |
| Paas (mentaler Aufwand) | 1–9 | Deskriptiv |

Die **Practice-Story** (`US0`) durchläuft denselben Ablauf, wird aber als `practice` gespeichert und nicht in
`trials.csv` aufgenommen. Sie zählt nicht zu den Analysen.

### 1.3 Nach den Stories

| Was | Format | Zweck |
|---|---|---|
| Präferenz-Ranking | „Review am Ende“ vs. „Pause mittendrin“, Reihenfolge | Deskriptiv |
| Kommentar | Freitext, max. 2 000 Zeichen | Deskriptiv/qualitativ |
| Dauer | ms | Deskription |

## 2. Indirekt erhoben (Telemetrie)

### 2.1 Zeiten

| Maß | Bedeutung |
|---|---|
| `planMs` | Plan gezeigt → „Approve plan“ |
| `stage1DwellMs` | Agent gestoppt → Accept/Reject |
| `stage2ProbeLatencyMs` | Verhaltensfrage gezeigt → abgeschickt |
| `finalReviewMs` | Fertiges Feature gezeigt → „I've finished reviewing“ |
| `uK_ms` | Zeit auf der Verständnisfrage K (auch bei Zurückgehen) |

### 2.2 Review-Verhalten (Fenster `stage1` und `final`)

| Maß | Bedeutung |
|---|---|
| `changesViewMs` | Wie lange die Changes-Ansicht offen war |
| `diffCoverage` | Wie weit im Diff gescrollt wurde (0–1) |
| `filesOpened` | Anzahl unterschiedlicher Dateien, die im Dateibaum geöffnet wurden |
| `hunks`, `hunksViewed` | Hunks im reviewten Code; wie viele ≥ 1 s auf dem Bildschirm waren |
| `fileMs` | Zeit pro Datei auf dem Bildschirm (im Roh-Event) |
| `hunkMs` | Zeit pro Hunk auf dem Bildschirm (im Roh-Event) |
| `flawRegionMs`, `flawRegionSeen` | Zeit, in der die Flaw-Zeilen sichtbar waren; ≥ 1 s = gesehen (auch bei Correct als Baseline) |
| `terminalCommands` | Im Terminal eingegebene Befehlszeilen |
| `testRuns`, `testFailRuns` | Läufe von `node --test`/`npm test`; davon mit Fehlschlägen |
| `unfocusedMs` | Zeit, in der das Studienfenster nicht fokussiert/sichtbar war |
| `idleMs` | Zeit ohne Eingabe, jeweils nach den ersten 30 s |
| `chatScrollBacks` | Wie oft im Chat vom Ende weggescrollt wurde |
| `toolExpands` | Wie oft ein eingeklappter Tool-Call aufgeklappt wurde |

### 2.3 Ereignisse (jeweils mit Zeitstempel)

| Ereignis | Daten |
|---|---|
| `click` | Label des angeklickten Elements in opencode (Button, Link, Tab, Datei, Menüpunkt), Bereich `review`/`terminal`; nicht auf den Studienseiten |
| `review` | Changes-Ansicht auf/zu |
| `diff_scroll` | Scroll-Abdeckung 0–1 |
| `diff_view` | Sichtbare Datei und Zeilenbereiche, alle 500 ms |
| `file` | Pfad einer geöffneten Datei |
| `terminal` | Terminal auf/zu |
| `terminal_command` | Vollständige Befehlszeile |
| `test_result` | Pass/Fail-Zahlen aus `node --test` |
| `focus` | Fenster im/außer Fokus |
| `idle` | 30 s ohne Eingabe / nächste Eingabe |
| `chat_scroll` | Chat vom Ende weggescrollt / zurück |
| `tool_expand` | Tool-Call aufgeklappt |

### 2.4 Agent und Server

- **Ablauf:** `session_start` (mit komplettem Session-Plan), `presurvey_*`, `trial_start`, `plan_*`, `review_shown`,
  `stage1_submit`, `probe_shown`, `stage2_submit`, `final_review_shown`, `reviewed`, `trial_end`, `postsurvey_*`,
  `debrief_shown`, `finish`.
- **Agent:** `agent_turn` (die für die Person gesendete Nachricht und Dauer), `replay_call` (welche aufgezeichnete
  Antwort an welcher Position, Tool-Namen, ob ein Varianten-Patch angewendet wurde), `replay_checkpoint`,
  `replay_error`; dazu opencodes eigene Ereignisse (`agent_*`: Nachrichten, Tool-Calls, Dateien, Berechtigungen) und
  blockierte API-Aufrufe.
- **Fehler:** `server_error`.

### 2.5 Bildschirmaufnahme (rrweb)

- DOM-Snapshot, danach jede Änderung; Mausbewegung (alle 200 ms), Scrollen, Eingaben, Viewport-Änderungen.
- Alle 5 s als Batch an den Server; etwa 1 MB pro Minute.
- **Nicht** aufgezeichnet: Kamera, Mikrofon, alles außerhalb des Studienfensters; der Terminal-Inhalt (Canvas) —
  seine Befehle und Testergebnisse werden aber als Ereignisse protokolliert.
- Passwortfelder sind maskiert. Jede Studienphase wird als Marker im Recording gesetzt.
- Abschaltbar mit `--no-recording`; der Einwilligungstext erwähnt sie nur dann.

### 2.6 Daraus berechnet

- **Code auf dem Bildschirm:** pro Datei und Hunk die Zeit; „gesehen“ = mindestens 1 s.
- **Flaw-Region:** die Zeilen, die sich zwischen Correct und Flawed unterscheiden; Zeit sichtbar und „gesehen“.
- **Hunks:** aus dem Capture berechnet (LCS-Zeilen-Diff, Kontext wie bei git), nicht aus dem Screenshot.
- **Abdeckung:** weiteste Scroll-Position im Diff.
- **Zustände:** Changes-Ansicht offen, unfokussiert, idle — jeweils nur innerhalb des Messfensters.

Wichtig: „auf dem Bildschirm“ heißt nicht „gelesen“. Diese Maße sind eine Obergrenze für Aufmerksamkeit, kein
Beweis dafür.

## 3. Wo die Daten landen

| Datei | Inhalt |
|---|---|
| `<id>_<seed>.events.jsonl` | Jedes Ereignis, fortlaufend und fsynced: `{t, type, data}` |
| `<id>_<seed>.recording.jsonl` | rrweb-Ereignisse, alle 5 s (ohne `--no-recording`) |
| `<id>_<seed>.json` | Beim Finish: Session-Plan, 6 Trials, Practice, Umfragen, komplettes Event-Log |
| `trials.csv` | Beim Finish: eine Zeile pro gemessenem Trial, über Sitzungen angehängt |

Eine abgebrochene Sitzung hat Event-Log und ggf. Recording, aber kein Bundle und keine CSV-Zeile. Zugriff: `exports/`
ist `0700`; im Container läuft der Agent als eigener UID und kann es nicht lesen.

## 4. Was nicht erhoben wird

- **Kein Name, keine E-Mail, keine Kontaktdaten** — vorgesehen ist eine zufällige Participant-ID. Wird beim Start
  versehentlich ein echter Name als ID verwendet, ist er der Identifier und muss vor der Auswertung ersetzt werden.
- **Keine Kamera, kein Mikrofon, keine Aufnahme anderer Fenster oder des Bildschirms.**
- **Keine Passwörter** (rrweb maskiert Passwortfelder).
- **Keine freien Chat-Nachrichten an den Agenten:** Der Composer ist ersetzt, die Person kann nur die vorgesehenen
  Aktionen auslösen.
- **Kein Terminal-Bildinhalt im Recording** (Canvas), aber die Befehlszeilen und Testergebnisse werden geloggt.
- **Kein Auslesen der Zwischenablage.** Was jemand in das Kommentarfeld einfügt, ist Teil des Kommentars und wird
  gespeichert.
- Der Freitext-Kommentar ist freiwillig und kann personenbezogene Angaben enthalten; er wird nur für die Auswertung
  verwendet.

## 5. Sensibilität und offene Punkte

- Die **Bildschirmaufnahme** ist das sensibelste Datum. Sie zeigt Mausbewegungen, Scrollen und Klicks; der
  Terminal-Inhalt fehlt, aber Befehle sind separat geloggt.
- **Klick-Labels** und **Terminal-Befehle** können verraten, wonach jemand gesucht hat. Das ist für die Analyse
  nützlich, aber erklärungsbedürftig in der Einwilligung.
- **Aufbewahrung und Löschung** müssen zur Ethik passen: Wie lange liegen die Rohdaten, wer hat Zugriff, wie werden
  sie gelöscht? Das ist noch festzulegen.
- **Idle und Fokus** sind grobe Maße: Lesen ohne Mausbewegung > 30 s zählt als idle; ein zweiter Bildschirm als
  unfokussiert.
