# Beacon study harness: telemetry

Everything the harness records, where it comes from, and how the per-trial measures are computed. For the
architecture see [technical.md](technical.md).

## 1. Sources and files

| Source | Recorded by | Ends up in |
|---|---|---|
| Study flow: screens shown, decisions, answers, timings | The study server (`machine.ts`) | Event log, trial results |
| The agent: opencode's own event stream, replayed responses, checkpoints, turns | The server (`agent.ts`, `replay.ts`) | Event log (`agent_*`, `replay_call`, `replay_checkpoint`, `agent_turn`) |
| The participant inside opencode: changes view, code on screen, files, terminal, focus, idleness, chat | The study build of opencode's web app (`agent-ui/study/telemetry.ts`) → `POST /_study/event` | Event log (`ui_*`), aggregated into trial results and `review_window` |
| Quiz behaviour: time per question, answer changes | The understanding page (`pages.tsx`) | Trial results |
| Screen recording (rrweb) | `telemetry.ts` → `POST /_study/recording` | `<id>_<seed>.recording.jsonl` |

Files in `exports/` (demo sessions: `exports-demo/`):

| File | Written | Contents |
|---|---|---|
| `<id>_<seed>.events.jsonl` | Continuously, fsynced per event | Every event, one JSON object per line: `{t, type, data}`; `t` is the server's clock in ms |
| `<id>_<seed>.recording.jsonl` | Every 5 s, fsynced | rrweb events, one per line (§7); absent with `--no-recording` |
| `<id>_<seed>.json` | At Finish | The bundle: session plan, six trial results, practice result, surveys, the full event log |
| `trials.csv` | At Finish, appended | One row per measured trial (§4) |

A session that is aborted has an event log (and recording) but no bundle and no CSV rows. All timestamps are taken on
the server when an event arrives. Browser and server run on the same machine, so the delay is a few milliseconds.

## 2. How the measures are computed

### 2.1 Measurement windows

The server measures participant behaviour in three windows per trial:

| Window | Opens | Closes | Code it is about (agent steps) |
|---|---|---|---|
| `stage1` | The agent stops for the scored review (`review_shown`) | Accept/reject | BATCH: 1–4; a pause: the paused step |
| `probe` | Accept/reject | The behaviour question is submitted | none |
| `final` | The finished feature is shown (`final_review_shown`) | "I've finished reviewing" | BATCH: 1–4; a pause: the steps after it |

The step range is what opencode's changes view shows at that point: everything the agent has not committed yet.

When a window closes, the server logs a `review_window` event (§5) with all its details. The `stage1` and `final`
summaries go into the trial result.

### 2.2 States

Three on/off states are timed on the server from the client's reports:

| State | On when | Reported by |
|---|---|---|
| Changes view open | opencode's review panel is visible | `review` |
| Unfocused | The study window is hidden or another window has focus | `focus` |
| Idle | No pointer, keyboard, wheel or touch input for 30 s | `idle` |

A state's time counts in a window only between the window's opening and closing. A state that is already on when a
window opens counts from the opening (e.g. the changes view opened while the agent was still working). Idle time
includes the first 30 s of inactivity only from the moment idleness is reported, so `idleMs` is the time beyond those
30 s.

### 2.3 Code on screen

Twice a second the client works out which code lines are visible (§3, `diff_view`): for each code view on screen,
the file and the first and last line visible in the new version of the file. Deleted lines in a diff are ignored,
since they are no longer part of the code. The client reports whenever this changes. The server credits the time
between two reports to:

- every file on screen (`fileMs`),
- every hunk overlapping a visible range (`hunkMs`),
- the flaw region, if any of its ranges overlaps a visible range (`flawMs`).

**Hunks** are computed from the trial's capture, not from the screen: the lines changed by the window's steps (a longest
common subsequence line diff of each file before and after those steps), with runs at most six unchanged lines apart
merged, which matches git's hunks with three lines of context.

**The flaw region** is the set of lines that differ between the Correct and the Flawed variant, located in the
trial's own variant after the window's last step. It exists in both variants, so Correct trials give the baseline for
how much attention the same lines get without a defect. It is empty in the practice story, and when the flaw step
comes after the window's last step (a pause before the flaw step was written).

Code counts as **seen** when it was on screen for at least 1 s in total during the window.

Visible is not the same as read. These measures say where the participant could have been looking.

## 3. Client events (`ui_*`)

The study build sends these to `POST /_study/event`. The server validates them (`UiEvent` in `shared/src/view.ts`)
and logs each as `ui_<type>`, adding `phase` and `trial` (position; 0 = practice).

| Event | Data | Sent when | How it is detected |
|---|---|---|---|
| `click` | `label`, `area?` (`review`, `terminal`) | Any click inside opencode, except on the study prompt (its decisions are logged by the server; its Files and Terminal buttons show up as the explorer or terminal opening) | Capture-phase listener; label is the `aria-label` or text of the closest button, link, tab, tree item, option or menu item |
| `review` | `open` | The changes view opens or closes | Visibility of `[data-component="session-review-v2"]`, checked every 500 ms |
| `diff_scroll` | `coverage` (0–1) | The furthest point scrolled in the changes view grows by ≥ 5 %, or reaches the end | Longest scroll area inside the review; `(scrollTop + clientHeight) / scrollHeight`. Reset when a review starts |
| `diff_view` | `views: [{file, from, to}]` | The code lines on screen change; `[]` when none | Every 500 ms: each visible `diffs-container` (opencode's code renderer); visible `[data-line]` rows in its shadow root, clipped by every scrolling ancestor; deletions skipped. File: the review's file header, otherwise the file last picked in a file tree |
| `file` | `name` (path) | A file (not a folder) is picked in a file tree, in the changes view or the file browser | Click on an element with `data-path` |
| `terminal` | `open` | The terminal panel opens or closes | Visibility of `[data-component="terminal"]`, every 500 ms |
| `terminal_command` | `line` | Enter is pressed in the terminal | The terminal's websocket input, reassembled into lines (backspace, Ctrl+C and Ctrl+U handled; escape sequences removed) |
| `test_result` | `pass`, `fail` | A `node --test` run prints its summary in the terminal | The terminal's websocket output, searched for `ℹ pass N … ℹ fail N` |
| `focus` | `focused` | The window gains or loses focus, or is hidden/shown | `focus`/`blur`/`visibilitychange`, re-checked every 500 ms; `focused = visible && document.hasFocus()` |
| `idle` | `idle` | 30 s without input (`true`); the next input (`false`) | Pointer, keyboard, wheel and touch listeners |
| `chat_scroll` | `back` | The chat is scrolled more than 200 px away from its end (`true`), or back to it (`false`) | Scroll events on the chat's scroll area; `true` only within 1 s of scrolling input (wheel, keys, touch, or a press on the scroll area), so new messages and layout changes do not count |
| `tool_expand` | `label` | A collapsed tool call in the chat ("Used 2 Write, Shell", "Updates") is expanded | Click on the toggle in `[data-component="collapsed-tool-group"]` or `[data-component="tool-trigger"]` while it is collapsed |

When the page (re)loads, the client first sends its current state (`focus`, `idle: false`, `review: false`,
`diff_view: []`), so a reload never leaves the server with a state from the previous page. The page reloads once at
the start of a session (opencode's stored state of the previous participant is cleared).

## 4. Per-trial results (`trials.csv`, `bundle.trials`)

One row per measured trial. The practice trial has the same fields in `bundle.practice`.

### Identity and condition

| Column | Meaning |
|---|---|
| `participant_id`, `study_seed`, `group` | Session identity; counterbalancing group 0–5 |
| `position`, `story` | Order in the session (1–6); story id |
| `regime`, `variant` | BATCH / MILESTONE / NON_MILESTONE; Correct / Flawed |
| `milestoneStep` | Step (1–3) that meets the milestone criteria in this story |
| `flawStep` | Step whose code differs between the variants (null for the practice story, in `bundle.practice`) |
| `pauseStep` | Step after which the scored review happened (BATCH: 4) |
| `probeStep` | Step the behaviour question asked about (the paused step; BATCH: the flaw step) |
| `reviewedLines` | Lines of code in the scored review (BATCH: the whole feature; a pause: the paused step) |

### Decision and behaviour question

| Column | Meaning |
|---|---|
| `initialDecision`, `finalDecision`, `decisionReversed` | Accept/reject before and after the behaviour question |
| `stage2ProbeLatencyMs` | Time from the behaviour question being shown to its submission |
| `probeAnswer` | Chosen option in canonical order (-1 = "I don't know") |
| `probeCorrect` | The chosen option is what the code prints (graded by running it) |

### Timing

| Column | Meaning |
|---|---|
| `planMs` | Plan shown → "Approve plan" |
| `stage1DwellMs` | Agent stopped for review → accept/reject |
| `finalReviewMs` | Finished feature shown → "I've finished reviewing" |

### Review behaviour before the decision (window `stage1`)

| Column | Meaning |
|---|---|
| `changesViewMsStage1` | Time the changes view was open |
| `diffCoverageStage1` | Furthest point scrolled in its diff (0–1; 0 = never opened) |
| `filesOpenedStage1` | Distinct files picked in a file tree |
| `hunksStage1`, `hunksViewedStage1` | Hunks in the reviewed diff; those on screen for ≥ 1 s |
| `flawRegionMsStage1`, `flawRegionSeenStage1` | Time the flaw region was on screen; whether ≥ 1 s (0/false when there is no region yet) |
| `terminalCommandsStage1` | Commands typed in the terminal |
| `testRunsStage1` | Commands among them that run the tests (`npm test`, `npm t`, `npm run test`, `node --test …`, `node ….test.ts`) |
| `testFailRunsStage1` | Test runs whose summary reported at least one failure |
| `unfocusedMsStage1` | Time the study window was hidden or not focused |
| `idleMsStage1` | Time without input, beyond the first 30 s of each idle stretch |
| `chatScrollBacksStage1` | Times the chat was scrolled back from its end |
| `toolExpandsStage1` | Tool calls expanded in the chat |

### During the behaviour question (window `probe`)

| Column | Meaning |
|---|---|
| `terminalCommandsProbe` | Commands typed in the terminal (running the code to check) |

### Final review (window `final`)

| Column | Meaning |
|---|---|
| `changesViewMsFinal` | Time the changes view was open |
| `hunksFinal`, `hunksViewedFinal` | Hunks in the steps the changes view shows now (BATCH: all; a pause: the steps after it); those seen |
| `flawRegionMsFinal`, `flawRegionSeenFinal` | As above |
| `unfocusedMsFinal`, `idleMsFinal` | As above |

### Understanding and effort

| Column | Meaning |
|---|---|
| `understandingScore` | Correct understanding answers (0–4) |
| `uK_answer`, `uK_correct`, `uK_confidence` | Item K (asks about agent step K): chosen option in canonical order, correct, confidence (50–100 %) |
| `uK_milestone` | Step K is the milestone step |
| `uK_ms` | Time on item K's screen, summed over visits (going back and forth) |
| `uK_changes` | Times the answer to item K was changed after the first pick |
| `paas` | Mental effort for the feature (1–9) |

In the bundle the per-item values are arrays: `understandingAnswers`, `understandingCorrects`,
`understandingConfidences`, `understandingItemMs`, `understandingAnswerChanges`.

## 5. `review_window` details

Logged when a window closes. Data:

| Field | Meaning |
|---|---|
| `trial`, `window`, `ms` | Trial position; `stage1`, `probe` or `final`; window length |
| `changesMs`, `coverage`, `files`, `commands`, `tests`, `testFails` | As in the trial result |
| `hunks`, `hunksViewed`, `flawMs`, `flawSeen` | As in the trial result |
| `unfocusedMs`, `idleMs`, `chatBacks`, `toolExpands` | As in the trial result |
| `fileMs` | `{path: ms}`: time each file was on screen |
| `hunkMs` | `[{file, from, to, ms}]`: every hunk of the window's code with its time on screen |
| `flawRegion` | `[{file, from, to}]`: the flaw region's line ranges |

Lines are 1-based and inclusive, in the file as it is after the window's last step.

## 6. Event log reference

Server events:

| Type | Data |
|---|---|
| `session_start` | Participant, seed, group, the full session plan |
| `presurvey_shown`, `presurvey_submit` | Answers, scores (NCS-6 mean with items 3–4 reverse-keyed, S-TIAS mean), attention check passed, duration |
| `trial_start` | Practice flag, position, story, regime, variant, milestone, flaw and pause step, opencode session id |
| `agent_turn` | Trial, the message sent for the participant, duration of the turn |
| `replay_call` | A recorded response served: thread (`main` or its key), position, tool names, whether it ends the turn, whether a variant patch was applied |
| `replay_checkpoint` | The replay stopped for review before this main-thread position |
| `replay_error` | A request the replay could not answer from the capture (answered with the idle text) |
| `plan_shown`, `plan_approved` | Trial; time to approval |
| `review_shown` | Trial, pause step |
| `stage1_submit` | Decision, dwell time, the `stage1` window summary |
| `probe_shown` | Trial, probe step |
| `stage2_submit` | The trial result so far, the executed answer, the displayed answer index |
| `final_review_shown`, `reviewed` | Trial; final review time |
| `review_window` | §5 |
| `trial_end` | The complete trial result |
| `postsurvey_shown`, `postsurvey_submit` | Ranking, comment, duration |
| `debrief_shown`, `finish` | — |
| `agent_<type>` | opencode's own events (session status, messages, parts, files, permissions; streaming deltas and heartbeats left out) |
| `agent_request_blocked` | Method and URL of a refused opencode API request |
| `ui_<type>` | §3 |
| `server_error` | Message of an unexpected server error |

Everything in the trial results can be re-derived from the event log.

### Selectors the client depends on

opencode's DOM is internal and can change with a new version. The client relies on:
`[data-component="session-review-v2"]`, `[data-slot="session-review-v2-file-path"]`,
`[data-slot="session-review-v2-file-name"]`, `diffs-container` with `[data-line]` and `data-line-type` in its shadow
root, `[data-deletions]`, `[data-path]` on file tree rows, `[data-component="terminal"]`,
`[data-component="session-turn"]`, `[data-component="collapsed-tool-group"]`, `[data-component="tool-trigger"]`,
the terminal websocket paths `/api/pty/` and `/api/experimental/persistent-pty/`, and the `node --test` summary
format. Re-check these when upgrading opencode.

## 7. Screen recording

With recording on (the default; `--no-recording` or `SESSION_RECORDING=0` turns it off), the study build loads
[rrweb](https://github.com/rrweb-io/rrweb) 2.1.7 from the study server and records the page: a DOM snapshot, then
every change, mouse movement (sampled every 200 ms), scroll (200 ms), input and viewport change. It is not a video
and does not use the camera, microphone or screen capture.

- Every 5 s the client sends the batch to `POST /_study/recording`. Each line of `<id>_<seed>.recording.jsonl` is
  `{phase, trial, e}`: `e` is the rrweb event (with its own timestamp); `phase` and `trial` are the study state when
  the batch arrived.
- Each study phase change is marked with an rrweb custom event `{tag: "study", payload: {phase, trial}}`, so a
  replay can jump to a trial or phase.
- Not recorded: the terminal's contents (drawn on a canvas; its commands and test results are logged as events),
  password fields (masked), anything outside the study window.
- Size: roughly 1 MB per minute, depending on activity.

To replay, load the events into rrweb's player:

```js
import rrwebPlayer from "rrweb-player"; // npm i rrweb-player
const events = text.trim().split("\n").map((l) => JSON.parse(l).e);
new rrwebPlayer({ target: document.body, props: { events } });
```

The consent text mentions the recording only when it is on. Check that the wording matches the approved ethics
protocol.

## 8. Surveys (`bundle.survey`)

- **Before**: consent, demographics (age group, programming experience, AI-assistant use, code-review frequency,
  TypeScript familiarity), NCS-6 (mean; items 3–4 reverse-keyed), attention check (pass/fail), S-TIAS (mean),
  duration.
- **After**: ranking of the two styles participants can tell apart (review at the end vs. a pause partway through),
  optional comment, duration.

## 9. Limitations

- **On screen is not read.** Code-on-screen measures are an upper bound on attention.
- **Idle threshold.** Reading code without moving the mouse for more than 30 s counts as idle. Use `idleMs` as a
  rough check, not as time off task.
- **Unfocused** includes the participant looking at another window on purpose (e.g. a second monitor).
- **File attribution outside the changes view** uses the file last picked in a file tree. Code views opened another
  way (e.g. a link in the chat) may be attributed to the wrong file.
- **Hunks** approximate git's: the participant may switch the changes view to another diff mode, but code on screen
  is still credited by file and line.
- **Test results** are detected from `node --test` output only; other commands' results are not interpreted.
- **Chat scroll-backs** need a scroll gesture within 1 s; dragging the scrollbar slowly may be missed.
- **Timing source.** All times are server receipt times; the client's 500 ms sampling adds up to 0.5 s of error per
  state change.
