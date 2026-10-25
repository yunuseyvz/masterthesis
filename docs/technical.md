# Beacon: technical documentation

This document describes how the project is built and how its parts fit together. What the study records is in
[telemetry.md](telemetry.md). How to run things is in the [README](../README.md) and
[capture-tool/README.md](../capture-tool/README.md).

## 1. Overview

The project has two tools that meet in one file format:

- The **capture tool** (`capture-tool/`) records a real [opencode](https://opencode.ai) v2 session with a real model. It
  sits between opencode and the model as a proxy and records every model response as it was streamed (each chunk
  with its timing), the person's messages, and the project before each response.
- The **study harness** (`study-harness/`) runs the study. Participants work in opencode's own web app (a study build);
  the model behind the agent replays a capture 1:1. The study plants its **checkpoints** into the replay (the agent
  stops for review where the condition says) and its **variants** (one recorded tool call patched, e.g. to plant a
  flaw).

```
 capture-tool/                                         captures/<id>/              study-harness/
┌────────────────────────────────┐               ┌───────────────────┐       ┌──────────────────────────────────┐
│ opencode (TUI/web/scripted)    │               │ capture.json      │       │ trials/<id>/trial.json           │
│   │ /v1/chat/completions       │   writes      │  calls: chunks +  │ reads │   capture, step starts,          │
│   ▼                            ├──────────────►│  timing, threads  ├──────►│   variant patches, questions     │
│ recording proxy ──► real model │               │  turns            │       │ replay endpoint ◄── opencode     │
│   └─ snapshots the project     │               │ history.bundle    │       │   (participant's study session)  │
└────────────────────────────────┘               └───────────────────┘       └──────────────────────────────────┘
```

At run time, inside the study container:

```
 browser (app window)                       container
┌─────────────────────────┐       ┌──────────────────────────────────────────────────────────┐
│ opencode web app        │       │ study server (Fastify, root)                             │
│  + study module         │ HTTP  │  /_study/*      study API, telemetry, recording          │
│    (agent-ui/study)     ├──────►│  /api, /auth    proxy to opencode (+ password, filters)  │
│                         │  WS   │  /*             agent-ui/dist (the web app)              │
└─────────────────────────┘       │        │                    ▲                            │
                                  │        │ drives turns       │ OpenAI-compatible          │
                                  │        ▼                    │ /v1/chat/completions       │
                                  │ opencode serve (uid 61234) ─┘ replay endpoint (capture)  │
                                  │  tools write files and run shells in /work/<id>/<trial>  │
                                  └──────────────────────────────────────────────────────────┘
```

opencode executes the replayed tool calls for real, so files, diffs and test runs come out as in the captured
session. Study page and agent share one origin; the browser never talks to opencode directly.

## 2. Repository layout

| Path | Contents |
|---|---|
| `shared/src/capture.ts` | The capture format (zod schema) and the helpers both tools must agree on: thread keys, positions, chunk parsing |
| `shared/src/` (rest) | Study types: session plan, trial results, actions, UI events (`schema.ts`, `view.ts`), plan generator (`session.ts`), seeded PRNG |
| `capture-tool/src/record.ts` | `record`: prepares the project, runs opencode with the recording proxy, collects the turns, writes the capture |
| `capture-tool/src/proxy.ts` | The recording proxy |
| `capture-tool/src/snapshots.ts` | Project snapshots in a git directory of their own |
| `capture-tool/src/opencode.ts` | Starts `opencode serve` and its terminal UI for a capture |
| `capture-tool/src/synthesize.ts` | Makes a capture from a scripted story (`capture-tool/synthetic/`) |
| `capture-tool/src/inspect.ts` | Prints a capture's outline with positions (for placing checkpoints) |
| `capture-tool/src/cli.ts` | `npm run capture -- record \| synthesize \| inspect` |
| `capture-tool/seeds/shopfront/` | The project captured sessions start from |
| `capture-tool/synthetic/US0..US6/` | Scripted stories (Correct code, narration, plan) |
| `captures/<id>/` | Captures: `capture.json`, `history.bundle` |
| `study-harness/trials/<id>/` | Trial definitions: `trial.json`, probe and understanding scripts |
| `study-harness/server/src/app.ts` | Fastify app: study routes, proxy to opencode, static hosting, recording endpoints |
| `study-harness/server/src/machine.ts` | `StudySession`: the study's state machine and telemetry aggregation |
| `study-harness/server/src/replay.ts` | The replay endpoint (the model during the study) |
| `study-harness/server/src/captures.ts` | Reads captures and their snapshots |
| `study-harness/server/src/trial.ts` | Trial definitions: steps, variants, workspaces at each step, diffs, hunks, flaw regions |
| `study-harness/server/src/agent.ts` | `OpencodeHost` (real opencode) and `FakeAgentHost` (tests, no UI) |
| `study-harness/server/src/workspace.ts` | Per-trial git repositories and step commits |
| `study-harness/server/src/lines.ts` | Line diff (LCS) and range helpers for hunks and flaw regions |
| `study-harness/server/src/runner.ts` | Runs probe and understanding scripts against a trial's code (grading) |
| `study-harness/server/src/sandbox.ts` | Privilege checks, process cleanup, ownership |
| `study-harness/server/src/export.ts` | Event log sink, bundle and `trials.csv` |
| `study-harness/agent-ui/` | The study build of opencode's web app: `study/`, `opencode.patch`, `build.sh` |
| `study-harness/scripts/` | `run-session.sh` (one participant session in a container), `forward.mjs` |
| `study-harness/Dockerfile` | The study image (built from the repository root) |

## 3. The capture format

A capture is a folder with `capture.json` (schema `Capture` in `shared/src/capture.ts`) and `history.bundle`.

| Field | Meaning |
|---|---|
| `format` | `beacon-capture/1` |
| `id`, `createdAt`, `source` | Name; time; `recorded` (real model) or `synthetic` |
| `opencodeVersion`, `model` | What produced it (model id and upstream URL) |
| `workspace.dir` | Absolute path of the project during the capture |
| `workspace.initial`, `workspace.final` | Snapshots (commits in the bundle) before the first request and after the session |
| `mainThread` | Thread key of the session the person drove |
| `turns` | The person's messages in that session: text, agent (`plan`, `build`, ...), time |
| `calls` | Every model request, in order |

A call:

| Field | Meaning |
|---|---|
| `index`, `at` | Order of arrival; ms after the capture started |
| `thread` | Conversation it belongs to (below) |
| `position` | Assistant messages already in the request: the call's place in its thread |
| `request` | Model, streamed or not, tool names, number of messages, last message preview |
| `status` | Upstream HTTP status |
| `chunks` | The response as received: each server-sent event's `data` verbatim, with `t` = ms after the request arrived. A non-streamed response is one chunk |
| `snapshot` | The project when the request arrived, i.e. after every earlier tool call ran |

**Threads.** opencode talks to the model in several conversations: the main session, subagent sessions, and side
requests such as title generation. `threadKey(body, workspaceDir)` identifies one: whether the request offers tools,
plus a hash of its first user message that is not one of opencode's `<system-reminder>`s, with the project path
replaced by a placeholder. The key is the same in a capture and in its replay, where the project lives elsewhere.

**Positions.** `assistantCount(body, ignore)` counts the assistant messages a request carries (ignoring empty ones
and the texts the harness injects). In opencode v2 each model response becomes one assistant message, so the n-th
response of a thread is requested with n assistant messages; a retried request has the same count and gets the same
response. This was checked against real opencode (§11).

**Snapshots.** One commit per call (and `initial`, `final`) in a git directory beside the project, excluding
`node_modules` and the project's own `.git`. The bundle holds them all.

## 4. The capture tool

### 4.1 Recording (`record`)

1. Copies the seed project (default `capture-tool/seeds/shopfront`) into a temporary folder, adds `.gitignore`, makes it a
   git repository with an "Initial commit" (as the harness does for a trial), and links the seed's `node_modules`.
2. Takes the initial snapshot and starts the recording proxy on a free loopback port.
3. Writes opencode's global config into a private home: one provider `capture`
   (`@opencode/ai/providers/openai-compatible`) whose base URL is the proxy, and the chosen model as default.
4. Starts `opencode serve` with a random `OPENCODE_PASSWORD`, then either opencode's terminal UI attached to it
   (`opencode --server <url> <project>`, the default), its web UI (`--web`), or scripted turns through the API
   (`--turns`).
5. When the session is over (the UI is closed, Ctrl+C, or the last scripted turn is done): takes the final snapshot,
   reads the session's messages from opencode's API (`GET /api/session?directory=…`, `GET /api/session/{id}/message`,
   paged by cursor) and keeps the person's messages with the agent active for each (`agent-switched` entries).
6. Picks the main thread (the key of the first message; otherwise the largest thread with tools), writes
   `capture.json` and the bundle, and removes the temporary folder.

### 4.2 The proxy

`RecordingProxy` forwards `POST …/chat/completions` unchanged to the upstream (`--upstream`, an OpenAI-compatible
API; key from `CAPTURE_API_KEY`), with opencode's own request headers, and streams the answer back unchanged. The
capture config denies opencode's `question` tool unless `--allow-questions` (a replayed question would wait for an
answer from the participant). `--brief FILE` is written as opencode's global `AGENTS.md` in the capture's private
home, so it is part of every request's system prompt (not a user message: thread keys are unaffected) and stored in
`capture.json`; the harness's opencode has no such file, and the replay serves responses without looking at the
system prompt. `capture-tool/briefs/study.md` makes the agent work in four announced steps, one per response, which
`inspect` turns into proposed step starts. Before forwarding it snapshots the project and
records the call's thread and position; while streaming it records each event with its arrival time. Other requests
(model lists) pass through unrecorded.

### 4.3 Synthetic captures (`synthesize`)

A scripted story (`capture-tool/synthetic/<id>/story.json`: brief, four steps with their files and narration, plan
exploration and `plan.md`) becomes a capture in the same format: a plan turn (read-only `read`/`glob`/`grep` calls,
then the plan) and a build turn (per step: narration with `write` calls for new files and `edit` calls for existing
ones; `node --test` after the step that writes the tests; a closing message). Timing is modelled on a streaming
model: 700 ms before the first token, 12 characters per 40 ms, tool arguments over `min(4000, 400 + characters)` ms.
The scripted stories hold only the Correct code; the Flawed variant is a patch in the trial (§6).

`npm test` checks that every `captures/US*` is exactly what `synthesize` makes from `capture-tool/synthetic/` (apart from
commit ids), so the two cannot drift apart. The trials no longer use them (§6.1); they stay as a fallback and as test
fixtures for the format.

## 5. The replay

`ReplayEndpoint` (`study-harness/server/src/replay.ts`) serves `POST /v1/chat/completions` on `127.0.0.1:REPLAY_PORT`.
opencode is configured with a provider "Study agent" pointing at it. For each request:

1. **Match.** Thread key and position (§3) select the recorded call.
2. **Main thread, not armed** (no study turn running): an empty reply after one of opencode's own reminders,
   otherwise "I'm waiting for you. Please use the study panel on the right to continue." Neither counts as a
   response.
3. **Checkpoint.** If the position is a stop the trial planted and it was not passed yet, the endpoint answers "I've
   paused here so you can review what I've done so far. I'll go on when you're ready." and disarms. The text is
   ignored when counting positions, so after the participant resumes the same position plays the recorded response.
4. **Serve.** Before a main-thread response, `onServe(position)` runs (the study commits finished steps there). The
   recorded chunks are rewritten (below) and streamed with their recorded times, scaled by `REPLAY_PACE` (1 =
   recorded timing). A main-thread response without tool calls ends the turn and disarms.
5. **Other threads** (subagents, titles) play their recordings; without one, side requests get "Study session".

**Rewriting.** The capture's project path is replaced by the trial's in everything the agent says and does, and
variant patches are applied to their tool calls. Text and tool arguments arrive split over many chunks, so each is
reassembled, changed, and spread back over the same chunks: the number of chunks and their times stay as recorded.
Unchanged chunks are sent byte for byte.

Every served response is logged as `replay_call`, every checkpoint as `replay_checkpoint`.

## 6. Trials

A trial (`study-harness/trials/<id>/trial.json`, schema `TrialDef` in `trial.ts`) turns a capture into a study task:

| Field | Meaning |
|---|---|
| `id`, `capture` | The trial folder's name (a session plays `US0`–`US6`); capture folder |
| `title`, `project` | Shown in the tab and the terminal |
| `approveTurn` | The recorded turn sent when the participant clicks "Approve plan" (turn 0, the request, is sent at the start) |
| `steps` (4) | `n`, `kind` (`scaffold`, `milestone`, `completion`; one milestone among steps 1–3), `summary`, `start`: main-thread position of the step's first response |
| `variants` | `Correct` and `Flawed`: patches `{position, tool, find, replace}`; usually one is `[]` (the capture as recorded) |
| `testFile` | The visible test suite |
| `probes`, `understanding` | Behaviour questions (one per step 1–3) and understanding items (one per step), with scripts and expected answers per variant |

**Checkpoints** go between steps: a pause after step k stops before `steps[k].start`. `npm run capture -- inspect
captures/<id>` lists positions with each response's text, tool calls and changed files, for choosing step starts.

**Patches.** In the tool call at `position`/`tool`, the one string argument containing `find` gets it replaced
(`find` must occur exactly once). The file the call writes or edits changes the same way in every later snapshot;
this is checked at every step boundary when the trial loads. All patches must lie in one step: the flaw step.

**Derived per trial**: `milestoneStep`, `flawStep`, the project after any response (`filesAfter`) and after each step
(`workspaceAt`), per-step diffs, hunks and flaw regions (the lines that differ between the variants).

### 6.1 The study's trials

The full recording protocol, with every prompt: [recording-protocol.md](recording-protocol.md).

`US0`–`US6` play recorded captures, `captures/<id>-deepseek` (DeepSeek V4.1 Flash on OpenCode Go). Each was recorded
with `capture-tool/turns/<id>.json` (the story's request in Plan mode, then "The plan looks good. Go ahead.") and two
briefs: `capture-tool/briefs/study.md` (four announced steps, one per response, tests in step 4) and the story's step
outline `capture-tool/briefs/outlines/<id>.md`, which fixes what each step does and so where the milestone falls:

| Story | Milestone | Flaw | Flaw (Flawed variant unless noted) |
|---|---|---|---|
| US0 | 2 | – | practice, no flaw |
| US1 | 2 | 2 | `reserveStock` checks `available && available < quantity`: a sold-out SKU (0 is falsy) can be reserved, stock goes negative |
| US2 | 3 | 2 | `applyPayment` converts with `Math.floor(Number(amount) * 100)` instead of `dollarsToCents`: "19.99" credits 1998 cents |
| US3 | 2 | 3 | `withQuota` checks `used + 1` instead of `used + amount`: a bulk operation can pass the limit |
| US4 | 1 | 3 | recorded code skips an outage that crosses the period boundary; the Correct variant clamps it to the period |
| US5 | 3 | 3 | a rejected request is recorded in the window too: a client that keeps retrying stays blocked |
| US6 | 1 | 1 | `discountFor` rejects `value >= 100`: a 100% coupon is refused |

Each flaw passes the agent's own step-4 tests (recorded after the flaw step, so they cannot be patched with it).
`trials.test.ts` also checks that steps 1–3 of every measured story are within a factor of 3 in changed lines, so a
pause after one step does not review far more code than a pause after another. Re-recording: the command in
`capture-tool/README.md` with the story's turns and outline; then re-derive the step starts (`inspect`), the patch and the
probe and understanding scripts, as the recorded code changes.

**Grading** never uses the participant's copy: `runProbe` writes the trial's finished project (in the trial's
variant) to a temporary folder and runs the script with node and a timeout.

`npm test` validates every trial: both variants pass the visible tests; every probe and understanding answer is what
the code prints, in both variants; only the probe and question about the flaw step differ; the milestone diff is
short; variants differ only in the flaw step; flaw regions lie inside the flaw step's hunks.

## 7. Study flow

### 7.1 Phases

The server holds the session state; the client renders `GET /_study/state` and posts actions (`shared/src/view.ts`):

| Phase | On screen | Leaves on |
|---|---|---|
| `intro` | Welcome page | `begin` |
| `presurvey` | Consent, demographics, NCS-6 with attention check, S-TIAS | `presurvey` (starts the practice trial) |
| `working` | opencode, the agent is running; spinner in the study prompt | the agent turn ends |
| `plan` | opencode with the agent's plan; "Approve plan" | `approvePlan` |
| `stage1` | The scored review: "Reject / flag defect" or "Accept" | `stage1` |
| `stage2` | Behaviour question about the reviewed step, then confirm or reverse | `stage2` |
| `reviewing` | The finished feature; "I've finished reviewing" | `reviewed` |
| `understanding` | Code hidden: four questions with confidence, then mental effort | `understanding` (next trial, or post-survey) |
| `postsurvey` | Preference ranking, comment | `postsurvey` |
| `debrief` | Debrief text | `POST /_study/finish` |
| `finished` | End page (demo: "Start again") | — |

An action in the wrong phase returns 409; an invalid one 400.

### 7.2 One trial

1. `startTrial` creates the trial's project from the capture's initial snapshot (§8), loads the replay (capture,
   variant patches, the checkpoint for the regime, the commit hook) and opens an opencode session with the agent of
   the capture's first turn. That turn (the request) is sent → the agent explores and plans → phase `plan`.
2. `approvePlan` sends the capture's approval turn (text and agent). The replay plays up to the checkpoint (BATCH: to
   the end). Steps before the paused one are committed as the replay passes their end → phase `stage1`.
3. `stage1` records accept/reject → phase `stage2` with the behaviour question for the reviewed step (BATCH: the flaw
   step).
4. `stage2` grades the answer, records confirm/reverse and, after a pause, commits the reviewed step and sends
   "Thanks, I've reviewed it. Please continue."; the replay plays the rest → phase `reviewing`.
5. `reviewed` hides the code → phase `understanding`. Its submission completes the trial result.

Every agent turn is started by the server (`StudySession.turn`): it arms the replay, calls `AgentHost.runTurn` and
waits until opencode reports the session idle.

### 7.3 Conditions and counterbalancing

`generateSessionPlan` (`shared/src/session.ts`) derives the session from participant ID, seed and group:

- Six measured stories (`US1`–`US6`) in the order of Williams row `group` (balanced for first-order carryover).
- Story `s` in group `g` gets cell `(s + g) mod 6`; cell `% 3` picks the regime (BATCH, MILESTONE, NON_MILESTONE),
  cells 0–2 are Correct and 3–5 Flawed. Every participant meets each regime × variant cell once; across six groups
  every story appears in every cell. N should be a multiple of 6.
- NON_MILESTONE draws which of the two non-milestone steps among 1–3 the agent pauses after (`pauseDraw`).
- Option orders of the behaviour question and of every understanding item are shuffled per trial.
- The practice trial (`US0`, MILESTONE, Correct) comes first and is not measured.

`run-session.sh` picks the group as the number of completed sessions in `exports/` modulo 6.

## 8. Trial projects

`createTrialWorkspace` creates `WORK_ROOT/<participant>/<NN>-<story>` from the capture's initial snapshot: a git
repository with one commit "Initial commit", `node_modules` linked to `/opt/shopfront/node_modules` (installed once
in the image), owned by the sandbox user.

`commitWorkspace` commits everything as the sandbox user under the agent's name ("Coding agent"). The study does
this at step boundaries before a checkpoint and when the participant resumes, so opencode's changes view always shows
the work since the last checkpoint. These commits are the study's, not the captured agent's; the agent's own git
commands (if the capture has any) run as recorded.

## 9. opencode

### 9.1 Host

`OpencodeHost` (`study-harness/server/src/agent.ts`) writes opencode's global config into `AGENT_HOME` (the replay provider),
starts `opencode serve` on loopback as the sandbox uid (through `setpriv`, cleared groups, `no_new_privs`), reads its
password, and uses the v2 API: create session (title, agent, model, directory), switch agent, prompt, and
`POST /api/experimental/session/{id}/wait`. It copies opencode's event stream into the study log as `agent_<type>`
(without streaming deltas and heartbeats).

`FakeAgentHost` (tests, `AGENT=fake`) asks the replay as opencode would and puts the project into each response's
recorded state.

### 9.2 Proxy

`app.ts` forwards `/api` and `/auth` (HTTP and websockets: the terminal) to opencode, adding the `authorization`
header and rewriting `Origin` to the upstream (opencode checks Origin against Host for the terminal). Requests that
would change the recorded session are refused with 403 and logged as `agent_request_blocked`: creating or deleting
sessions, prompting, commands and shells through the API, switching agents, forking, compacting, reverting,
generating, archiving and sharing.

## 10. The agent UI

`study-harness/agent-ui/build.sh` clones opencode at `OPENCODE_VERSION` (default `v2.1.3`) into `agent-ui/.cache` (or uses
`OPENCODE_SRC`), copies `study/` into `packages/app/src/study`, applies `opencode.patch` (two hooks: `<StudyGate>`
around the app, `<StudyDock>` in place of the composer), installs with bun 1.4.4 and builds `packages/app` into
`agent-ui/dist`.

| File in `study/` | Role |
|---|---|
| `store.ts` | Study state, calls to `/_study/*`, optimistic `working`, per-participant reset of opencode's local storage, no notification prompt |
| `gate.tsx` | English locale, telemetry and recording, tab menus blocked, navigation to the trial's session, study pages outside agent phases, condition tag when enabled |
| `dock.tsx` | Study prompts in opencode's question style; "Files" (opencode's project explorer) and "Terminal (Ctrl+`)" buttons |
| `pages.tsx` | Full-screen pages: intro, questionnaire, preparing, understanding questions, post-survey, debrief, end |
| `telemetry.ts` | Client-side telemetry and the rrweb recorder (telemetry.md) |
| `study.css` | Hides navigation that would leave the trial; one tab per trial, only the current one usable; page styles |

opencode's completion sound plays as usual; the browser's notification popup is suppressed.

## 11. Isolation

- The server runs as root only to start opencode as uid 61234 (`sandbox`), which owns only `/work` and `/agent-home`.
- `/app` (code, trials, captures) and `/exports` are `0700`; on the host, `exports/` and `.run/<id>` are `0700`.
- At startup the server checks as the sandbox uid that exports, trials, captures, its code and the socket directory
  are unreadable, and refuses to start otherwise (`ALLOW_READABLE_PATHS=1` skips this in development).
- The server listens on a unix socket in `/run/study`; `study-harness/scripts/forward.mjs` bridges it to `localhost:5185`.
  opencode and the replay endpoint listen on container loopback only.
- `run-session.sh` drops capabilities except those needed to switch users and manage files, sets
  `no-new-privileges`, and limits processes (512) and memory (3 GB). After Finish the sandbox user's processes are
  killed.

## 12. Configuration

### 12.1 Harness server environment

| Variable | Default | Meaning |
|---|---|---|
| `PARTICIPANT_ID`, `STUDY_SEED` | required | Identity (1–32 letters/digits) and seed |
| `STUDY_GROUP` | drawn from seed | Counterbalancing group 0–5 |
| `TRIALS_DIR` | `study-harness/trials` | Trial definitions |
| `CAPTURES_DIR` | `captures` | Captures |
| `EXPORT_DIR` | `/exports` | Exports |
| `STATIC_DIR` | `study-harness/agent-ui/dist` | The built agent UI |
| `LISTEN_SOCKET` / `LISTEN_HOST`, `PORT` | image: `/run/study/app.sock` / `127.0.0.1`, `5185` | Where the server listens |
| `SANDBOX_UID`, `SANDBOX_GID` | unset (image: 61234) | User opencode runs as |
| `ALLOW_READABLE_PATHS` | unset | `1` skips the isolation check |
| `AGENT` | opencode | `fake`: no opencode, no agent UI |
| `OPENCODE_BIN` | `node_modules/.bin/opencode` | opencode binary |
| `AGENT_PORT`, `REPLAY_PORT` | `4591`, `4590` | Loopback ports |
| `WORK_ROOT`, `AGENT_HOME` | `/work`, `/agent-home` | Trial projects; opencode's home |
| `REPLAY_PACE` | `1` | Timing factor for the replay: 1 = as recorded, 0 = instant |
| `SESSION_RECORDING` | on | `0` turns the screen recording off |
| `EXIT_ON_FINISH` | on | `0` keeps the server running after Finish |
| `DEMO`, `SHOW_CONDITION` | off | Demo restarts; condition tag in the UI (never for participants) |

### 12.2 `study-harness/scripts/run-session.sh`

`--participant ID`, `--seed N`, `--group 0-5` (generated when omitted), `--show-condition`, `--demo` (exports go to
`exports-demo/`), `--no-window`, `--no-recording`, `--dry-run`. Builds the image (`docker build -f study-harness/Dockerfile
.`), starts the container, the forwarder, and a browser app window.

### 12.3 Capture tool

`npm run capture -- record --id ID --model MODEL [--seed DIR] [--upstream URL] [--out DIR] [--web] [--turns FILE] [--brief FILE]`,
`synthesize --story DIR [--seed DIR] [--out DIR]`, `inspect DIR`. Environment: `CAPTURE_API_KEY` (upstream key),
`OPENCODE_BIN`.

## 13. Tests

- `npm test` (root): shared, harness and capture unit tests. Harness: trials (§6), replay (matching, checkpoints,
  patches, path rewriting, timing), proxy filter, the full study flow with the fake agent (project on disk and open
  git changes at every checkpoint), exports, demo mode, telemetry. Capture: format helpers, synthetic captures up to
  date.
- `OPENCODE_IT=1` runs the tests with the real opencode binary:
  - `capture-tool/src/capture.test.ts`: records a session with a scripted model through the proxy (calls, timing,
    snapshots, turns).
  - `study-harness/server/src/roundtrip.test.ts`: records a session with the capture tool, then replays it through real
    opencode in a new folder; same files, same responses, recorded timing.
  - `study-harness/server/src/opencode.test.ts`: the practice trial through real opencode (plan, checkpoint, finish).
- `npm run typecheck`. The study module is type-checked as part of opencode's app (`bun x tsc -b` in `packages/app`
  of the build checkout).

Browser checks ran against the Docker image with Playwright (`mcr.microsoft.com/playwright`) on the same Docker
network.

## 14. Maintenance notes

- **New capture for the study**: record it (capture-tool/README.md), inspect it, write `study-harness/trials/<id>/trial.json`
  with step starts, a variant patch, probes and questions, add its id to `RECORDED` in `trials.test.ts`, and run
  `npm test`. Example: `study-harness/trials/lowstock` on `captures/deepseek-lowstock-steps`. To play it in sessions, give it
  a `US1`–`US6` id (replacing that story) or extend `StoryId`/`STORIES` in `shared`.
- **Upgrading opencode**: change the tag in `study-harness/agent-ui/build.sh` and `study-harness/Dockerfile`, and `@opencode/cli`
  in `study-harness/server` and `capture`. Re-apply `opencode.patch`. Captures record what one opencode version asked; after
  an upgrade, re-run `OPENCODE_IT=1 npm test` and re-record captures if positions or thread keys no longer match.
  Also re-check the v2 API calls (`agent.ts`, `record.ts`), the blocked-request list, the selectors `study.css`
  hides, and the DOM selectors in `telemetry.ts` (telemetry.md §6).
- **Changing what is recorded**: add the UI event to `UiEvent` (`shared/src/view.ts`), handle it in
  `StudySession.recordUi`, add result fields to `TrialResult` and `CSV_COLUMNS`, and document it in telemetry.md.
