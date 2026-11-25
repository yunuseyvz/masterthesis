# Data collected

## Files

Each session writes to `exports/`:

| File | Contents |
|---|---|
| `<id>_<seed>.events.jsonl` | Every event as `{t, type, data}`, written as it happens |
| `<id>_<seed>.recording.jsonl` | Screen recording (rrweb), every 5 s; off with `--no-recording` |
| `<id>_<seed>.json` | At Finish: session plan, trial results, surveys, full event log |
| `trials.csv` | At Finish: one row per measured trial, appended across sessions |

A session that is aborted has a log but no bundle and no CSV rows. All timestamps are server receipt times.

## Direct

- **Before:** consent (online on Conditioner's entry page, locally in the questionnaire), demographics, NCS-6,
  attention check, S-TIAS.
- **Per story:** plan approval, accept/reject, behaviour question, reversal, answer to the agent after a rejection,
  five understanding questions with confidence, mental effort (Paas), three statements about the review.
- **After:** preference ranking, optional comment.

## Indirect

- **Times:** plan, first decision, behaviour question, final review, per question.
- **Review behaviour:** changes view open, scroll coverage, files opened, hunks on screen for at least 1 s,
  terminal commands, test runs and failures, unfocused time, idle time (beyond 30 s), chat scroll-backs, tool
  expansions, clicks.
- **Agent and server:** every model call, checkpoint, hidden reminder, opencode event and blocked API request.
- **Measurement windows:** `stage1` (scored review), `probe` (behaviour question), `final` (finished feature).

"On screen" is not "read": the code-on-screen measures are an upper bound on attention.

The columns of `trials.csv` are defined by `CSV_COLUMNS` in `study-harness/server/src/export.ts`, the events by
`UiEvent` in `shared/src/view.ts` and the session events logged in `study-harness/server/src/machine.ts`.

## Not collected

No name, e-mail or contact data (a random participant ID is used), no camera, microphone or other windows, no
password input (masked), no clipboard. The terminal's contents are not recorded, but its commands and test results are
logged. The optional comment is free text and may contain personal data.

## Open

The recording and the command log are the most sensitive data. Retention, access and deletion have to match the ethics
protocol, and the consent text has to name what is recorded.
