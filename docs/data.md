# Data collected

## Files

Each session writes to `exports/`:

| File | Contents |
|---|---|
| `<id>_<seed>.events.jsonl` | Every event as `{t, type, data}`, written as it happens |
| `<id>_<seed>.recording.jsonl` | Screen recording (rrweb), every 5 s; off with `--no-recording` |
| `<id>_<seed>.code.jsonl` | The code as played, one line per trial as it ends (`TrialCode` in `machine.ts`): the files that changed at each passed step check, at the first decision and at grading, each since the snapshot before; about 100 KB per session |
| `<id>_<seed>.json` | At Finish: session plan, trial results, surveys, full event log |
| `trials.csv` | At Finish: one row per measured trial, appended across sessions |

A session that is aborted has a log but no bundle and no CSV rows. All timestamps are server receipt times.

Answers are graded on the code as played. When a question's script prints no answer on that code, the answer is
missing (`null` in the bundle, an empty cell in `trials.csv`), not wrong.

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
- **The trial as played:** whether the code had the flaw at the first decision (`flawAtDecision`: present, absent,
  unwritten when its step came after the pause, unknown) and in the graded code (`flawAtEnd`), from the flaw step's
  behaviour question and the flaw item; in a Correct trial "present" means the model made the wrong decision on its
  own. Whether the open case came out as the outline settles it (`openCaseAsScripted`), and whether a step under review
  was accepted after failing its check twice (`pauseStepForced`). Per item: whether its script printed an answer
  (`uK_gradeable`) and whether that answer was none of the options and replaced a wrong one (`uK_adapted`).

"On screen" is not "read": the code-on-screen measures are an upper bound on attention. How long the flaw was on screen
is not measured live: the per-hunk times in each `review_window` event, with the code as played (`code.jsonl`), give it
afterwards.

The columns of `trials.csv` are defined by `CSV_COLUMNS` in `study-harness/server/src/export.ts`, the events by
`UiEvent` in `shared/src/view.ts` and the session events logged in `study-harness/server/src/machine.ts`.

## Not collected

No name, e-mail or contact data (a random participant ID is used), no camera, microphone or other windows, no
password input (masked), no clipboard. The terminal's contents are not recorded, but its commands and test results are
logged. The optional comment is free text and may contain personal data.

## Open

The recording and the command log are the most sensitive data. Retention, access and deletion have to match the ethics
protocol, and the consent text has to name what is recorded.
