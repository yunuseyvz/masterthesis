# Beacon: technical documentation

How the study harness is built and how its parts fit together, why it is built this way and how the agent did in
test runs (§13). What it records is in [telemetry.md](telemetry.md); how to run things in the
[README](../../README.md); what the pilot checks in [pilot-plan.md](../study/pilot-plan.md).

## 1. Overview

Participants work in [opencode](https://opencode.ai) v2, its own web app in a study build. A real model plays the
agent live. The study server sits between opencode and the model: it adds a hidden script per story (the
**Drehbuch**) to the agent's system prompt, and it serves the agent a `review_checkpoint` tool that it holds while the
participant reviews.

```
 browser (app window)                       container
┌─────────────────────────┐       ┌───────────────────────────────────────────────────────────┐
│ opencode web app        │       │ study server (Fastify, root)                              │
│  + study module         │ HTTP  │  /_study/*      study API, telemetry, recording           │
│    (agent-ui/study)     ├──────►│  /api, /auth    proxy to opencode (+ password, filters)   │
│                         │  WS   │  /*             agent-ui/dist (the web app)               │
└─────────────────────────┘       │        │ drives turns                                     │
                                  │        ▼                                                  │
                                  │ opencode serve (uid 61234) ──► live endpoint ──► model    │
                                  │   │  /v1/chat/completions      (adds the Drehbuch,         │
                                  │   │                             logs every call)           │
                                  │   └─► checkpoint tool (MCP) ── held while the participant  │
                                  │                                 reviews                    │
                                  │  tools write files and run shells in /work/<id>/<trial>   │
                                  └───────────────────────────────────────────────────────────┘
```

Study page and agent share one origin; the browser never talks to opencode directly.

## 2. Repository layout

| Path | Contents |
|---|---|
| `shared/src/` | Study types: session plan, trial results, actions, UI events (`schema.ts`, `view.ts`), plan generator (`session.ts`), seeded PRNG |
| `study-harness/project/` | `shopfront`, the Next.js project every trial starts from |
| `study-harness/trials/drehbuch.md` | The Drehbuch's general rules (steps, checkpoint, design decisions are final, asking after a rejection) |
| `study-harness/trials/<id>/` | One story: `trial.json`, the step outlines (`outline-correct.md`, `outline-flawed.md`), probe and understanding scripts, `reference/` |
| `study-harness/server/src/app.ts` | Fastify app: study routes, proxy to opencode, static hosting, recording endpoints |
| `study-harness/server/src/machine.ts` | `StudySession`: the study's state machine, the checkpoint logic and telemetry aggregation |
| `study-harness/server/src/live.ts` | The live endpoint: adds the Drehbuch, logs every call |
| `study-harness/server/src/proxy.ts`, `calls.ts` | The recording proxy in front of the model; thread keys, positions, chunk parsing |
| `study-harness/server/src/checkpoint.ts` | The checkpoint tool's MCP server |
| `study-harness/server/src/trial.ts` | Trial definitions and the Drehbuch per variant |
| `study-harness/server/src/reference.ts` | Each story's reference implementation (tests and the fake agent) |
| `study-harness/server/src/agent.ts` | `OpencodeHost` (real opencode) and `FakeAgentHost` (tests, no UI) |
| `study-harness/server/src/workspace.ts` | Per-trial git repositories, step commits, uncommitted changes |
| `study-harness/server/src/runner.ts` | Runs probe and understanding scripts on a trial's code (grading) |
| `study-harness/server/src/lines.ts`, `sandbox.ts`, `export.ts` | Line diffs and ranges; privilege checks; event log, bundle and `trials.csv` |
| `study-harness/server/src/live-run.ts` | Test runs of one story against the real model, without a participant |
| `study-harness/agent-ui/` | The study build of opencode's web app: `study/`, `opencode.patch`, `build.sh` |
| `study-harness/scripts/` | `run-session.sh` (one participant session in a container), `forward.mjs` |
| `study-harness/Dockerfile` | The study image (built from the repository root) |

## 3. Trials

A trial (`study-harness/trials/<id>/trial.json`, schema `TrialDef` in `trial.ts`):

| Field | Meaning |
|---|---|
| `id`, `title`, `project` | Folder name (a session plays `US0`–`US6`); shown in the tab and the terminal |
| `brief` | The participant's request, sent for them when the trial starts |
| `steps` (4) | `n`, `kind` (`scaffold`, `milestone`, `completion`; one milestone among steps 1–3), `summary` (the commit message) |
| `flawStep` | The step whose outline differs between the variants (null for the practice story) |
| `testFile` | The visible test suite the agent writes in step 4 |
| `outline` | The step outline per variant |
| `probes`, `understanding` | Behaviour questions (one per step 1–3) and understanding items (one per step), with scripts and the answers for each variant's reference code |

**The Drehbuch** for a trial is `drehbuch.md` followed by the variant's step outline. The outline fixes each step's
files, functions and design decisions, and so where the milestone falls. The Flawed outline differs in one design
decision, written as the team's decision and marked final:

| Story | Milestone | Flaw step | The Flawed outline's decision |
|---|---|---|---|
| US0 | 2 | – | practice, no flaw |
| US1 | 2 | 2 | a sold-out SKU is removed from the store: the next reservation gets 404, not 409 |
| US2 | 3 | 2 | dollars to cents with `Math.floor(amount * 100)`: "19.99" credits 1998 cents |
| US3 | 2 | 3 | a quota check counts one operation per call, whatever its `amount` |
| US4 | 1 | 3 | an outage that crosses the start or end of the billing period is skipped |
| US5 | 3 | 3 | rejected requests are recorded in the window too: a client that keeps retrying stays blocked |
| US6 | 1 | 1 | percentage coupons are valid below 100 only: a 100 % coupon is refused |

**The reference implementation** (`trials/<id>/reference/<variant>/step<n>/`) holds the files each step writes when
the outline is followed; a Flawed step without a folder writes what the Correct one does. It comes from the agent's
recorded sessions of the earlier replay design. It is not part of what participants see: `trials.test.ts` checks the
questions against it, and the fake agent writes it.

**Grading follows the code as played.** The behaviour question is graded on the code under review when it is asked
(`live_probe`), the understanding items on the code as the agent finished it (`live_key`). The question text is
fixed; if the code does something no option says, that outcome replaces a distractor (`adaptOptions` in
`machine.ts`). An item whose script cannot describe the code counts as wrong and is logged.

`npm test` checks every trial on its reference: the Correct variant passes the visible tests; every probe prints
its expected answer after its own step and at the end, in both variants; only the probe and item about the flaw step
differ between variants; steps 1–3 of each measured story are within a factor of 3 in changed lines; the README
never hints at the defect.

## 4. The live agent

### 4.1 The model endpoint

`LiveEndpoint` (`live.ts`) is opencode's only provider ("Study agent"). It forwards every request to the upstream
(`LIVE_UPSTREAM`, OpenAI-compatible; OpenCode Go by default) and streams the answer back unchanged. Requests of the
trial's main conversation get the Drehbuch appended to their system prompt on the way upstream. The main
conversation is recognised by its thread key: whether the request offers tools, and its first user message (the
brief) with the project path neutralised (`threadKey` in `calls.ts`). The Drehbuch is in no file opencode or the
participant's terminal can read. Every call is logged as `live_call`: trial, thread, position, timing, tools,
tokens.

### 4.2 The checkpoint

`CheckpointServer` (`checkpoint.ts`) is a minimal MCP server on loopback (streamable HTTP). opencode offers its tool
as `review_checkpoint` (server `review`, a direct tool, permission allow, execution timeout 4 h). The Drehbuch tells
the agent to call it after steps 1, 2 and 3; it calls it in every regime, so the conversation looks the same in all
of them. `StudySession.checkpoint` decides what a call does:

- **BATCH**: every call returns at once.
- **Before the paused step**: the step is committed, and the call returns at once.
- **The paused step**: the call is held. The agent waits, the changes view shows exactly that step, and the review
  opens. After an acceptance the step is committed and the call returns "continue with the next step".
- **After a rejection** the held call returns "ask what to change, then end your turn". The agent asks in the chat,
  and opencode's composer opens for one message (§5.2). The agent fixes the step and calls the checkpoint for it
  again, which commits the fix with the step.

If the agent ends its turn without reaching the paused step, the review shows what it did (`live_pause_missed`).

### 4.3 Preparation in the background

A trial is set up and planned while the participant is on a full-screen page: the first during the questionnaire,
each next one during the previous trial's understanding questions. Setting up means a fresh project, the endpoint
loaded with the trial's Drehbuch, a new opencode session, and the brief sent in Plan mode. If the participant is
faster than the plan, they wait for the rest (`waitedForPlanMs`).

## 5. Study flow

### 5.1 Phases

The server holds the session state; the client renders `GET /_study/state` and posts actions (`shared/src/view.ts`):

| Phase | On screen | Leaves on |
|---|---|---|
| `intro` | Welcome page | `begin` |
| `presurvey` | Consent, demographics, NCS-6 with attention check, S-TIAS | `presurvey` (starts the practice trial) |
| `working` | opencode, the agent is running; spinner in the study panel | the agent stops |
| `plan` | opencode with the agent's plan; "Approve plan" | `approvePlan` |
| `stage1` | The scored review: "Reject / flag defect" or "Accept" | `stage1` |
| `stage2` | Behaviour question about the reviewed step, then confirm or reverse | `stage2` |
| `feedback` | After a rejection: the agent's question, opencode's composer for the answer | the answer is sent |
| `reviewing` | The finished feature; "I've finished reviewing" | `reviewed` |
| `understanding` | Code hidden: four questions with confidence, then mental effort | `understanding` (next trial, or post-survey) |
| `postsurvey` | Preference ranking, comment | `postsurvey` |
| `debrief` | Debrief text | `POST /_study/finish` |
| `finished` | End page (demo: "Start again") | — |

An action in the wrong phase returns 409; an invalid one 400.

### 5.2 One trial

1. The prepared trial starts in `plan`: the agent's plan is on screen.
2. `approvePlan` sends "The plan looks good. Go ahead." (build agent). The agent works up to the held checkpoint
   (BATCH: to the end) → `stage1`.
3. `stage1` records accept/reject, runs the behaviour question's script on the code under review → `stage2`.
4. `stage2` grades the answer and records confirm/reverse.
   - Accepted: the step is committed, the agent finishes, the understanding key is computed → `reviewing`.
   - Rejected: the agent asks what to change (BATCH: the server sends "I'm rejecting this." for the participant) →
     `feedback`. The study proxy lets exactly one prompt from the composer through to this session
     (`acceptsComposerMessage`, `composerMessage`); the agent fixes and finishes → `reviewing`.
5. `reviewed` hides the code and starts preparing the next trial → `understanding`. Its submission completes the
   trial result.

### 5.3 Conditions and counterbalancing

`generateSessionPlan` (`shared/src/session.ts`) derives the session from participant ID, seed and group:

- Six measured stories (`US1`–`US6`) in the order of Williams row `group` (balanced for first-order carryover).
- Story `s` in group `g` gets cell `(s + g) mod 6`; cell `% 3` picks the regime (BATCH, MILESTONE, NON_MILESTONE),
  cells 0–2 are Correct and 3–5 Flawed. Every participant meets each regime × variant cell once; across six groups
  every story appears in every cell. N should be a multiple of 6.
- NON_MILESTONE pauses after one of the two non-milestone steps among 1–3 (`pauseDraw`). With `round` (`STUDY_ROUND`,
  completed sessions / 6) it alternates by `(round + group) mod 2`, so each candidate step gets half of a story's
  NON_MILESTONE trials. Without `round`, a coin flip per trial.
- Option orders of the behaviour question and of every understanding item are shuffled per trial.
- The practice trial (`US0`, MILESTONE, Correct) comes first and is not measured.

`run-session.sh` picks the group as the number of completed sessions in `exports/` modulo 6.

## 6. Trial projects

`createTrialWorkspace` creates `WORK_ROOT/<participant>/<NN>-<story>` from `study-harness/project`: a git repository
with one commit "Initial commit", `node_modules` linked to `/opt/shopfront/node_modules` (installed once in the
image), owned by the sandbox user. Every trial starts from the same project; no trial's code carries over.

`commitWorkspace` commits everything as the sandbox user under the agent's name ("Coding agent"), at the checkpoints
(§4.2), so opencode's changes view shows the work since the last one. The review's hunks and line count come from
the uncommitted changes (`uncommitted`).

## 7. opencode

`OpencodeHost` (`agent.ts`) writes opencode's global config into `AGENT_HOME`: the live provider only, the checkpoint
tool's MCP server, and permissions (the `question` tool denied, the checkpoint tool allowed, also per agent). Nothing
in it gives the condition away. It starts `opencode serve` on loopback as the sandbox uid (through `setpriv`,
cleared groups, `no_new_privs`) and uses the v2 API: create session, switch agent, prompt,
`POST /api/experimental/session/{id}/wait`. It copies opencode's event stream into the study log as `agent_<type>`.

`app.ts` forwards `/api` and `/auth` (HTTP and websockets: the terminal) to opencode, adding the `authorization`
header and rewriting `Origin`. Requests that would change the session or the agent's setup are refused with 403 and
logged as `agent_request_blocked`: creating or deleting sessions, prompting (except the one answer after a
rejection), commands and shells through the API, switching agents, forking, compacting, reverting, generating,
archiving, sharing, and any change to MCP servers or the configuration. Setting the session's model stays allowed:
the composer sends it before every message, and the configuration has only the live model.

`FakeAgentHost` (tests, `AGENT=fake`) stands in for opencode and the model: it writes the reference code step by step
and calls the checkpoint as the Drehbuch asks.

## 8. The agent UI

`study-harness/agent-ui/build.sh` clones opencode at `OPENCODE_VERSION` (default `v2.1.3`) into `agent-ui/.cache` (or
uses `OPENCODE_SRC`), copies `study/` into `packages/app/src/study`, applies `opencode.patch`, installs with bun 1.4.4
and builds `packages/app` into `agent-ui/dist`. The patch has three hooks: `<StudyGate>` around the app; in the
composer region the study panel replaces the composer (except in the feedback phase); and in study mode the file
extension opens its "Open file" tab, the whole file tree, in every session.

| File in `study/` | Role |
|---|---|
| `store.ts` | Study state, calls to `/_study/*`, polling while the agent works on its own, per-participant reset of opencode's local storage, no notification prompt |
| `gate.tsx` | English locale, telemetry and recording, tab menus blocked, navigation to the trial's session, study pages outside agent phases, condition tag when enabled |
| `dock.tsx` | Study prompts in opencode's question style; "Files" and "Terminal (Ctrl+`)" buttons |
| `pages.tsx` | Full-screen pages: intro, questionnaire, preparing, understanding questions, post-survey, debrief, end |
| `telemetry.ts` | Client-side telemetry and the rrweb recorder (telemetry.md) |
| `study.css` | Hides navigation that would leave the trial, the model switcher and the MCP switches; one tab per trial |

The server answers `/sw.js` with a worker that clears the browser's caches and unregisters itself, so a browser
never keeps an older build from an earlier session on the same address.

## 9. Isolation

- The server runs as root only to start opencode as uid 61234 (`sandbox`), which owns only `/work` and `/agent-home`.
- `/app` (code and trials, with outlines, reference code and answer keys) and `/exports` are `0700`; on the host,
  `exports/` and `.run/<id>` are `0700`.
- At startup the server checks as the sandbox uid that exports, trials, its code and the socket directory are
  unreadable, and refuses to start otherwise (`ALLOW_READABLE_PATHS=1` skips this in development).
- The server listens on a unix socket in `/run/study`; `study-harness/scripts/forward.mjs` bridges it to
  `localhost:5185`. opencode, the live endpoint and the checkpoint server listen on container loopback only.
- Known and accepted: the sandbox user's terminal can reach the live endpoint and the checkpoint server over
  loopback. Sessions are supervised.
- `run-session.sh` drops capabilities except those needed to switch users and manage files, sets
  `no-new-privileges`, and limits processes (512) and memory (3 GB). After Finish the sandbox user's processes are
  killed.

## 10. Configuration

### 10.1 Server environment

| Variable | Default | Meaning |
|---|---|---|
| `PARTICIPANT_ID`, `STUDY_SEED` | required | Identity (1–32 letters/digits) and seed |
| `STUDY_GROUP` | drawn from seed | Counterbalancing group 0–5 |
| `STUDY_ROUND` | unset (coin flip) | Earlier sessions of the group; balances the NON_MILESTONE pause step |
| `LIVE_MODEL`, `LIVE_API_KEY` | required with opencode | The model that plays the agent, and the upstream key |
| `LIVE_UPSTREAM` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible API |
| `TRIALS_DIR`, `PROJECT_DIR` | `study-harness/trials`, `study-harness/project` | Trials; the starting project |
| `EXPORT_DIR` | `/exports` | Exports |
| `STATIC_DIR` | `study-harness/agent-ui/dist` | The built agent UI |
| `LISTEN_SOCKET` / `LISTEN_HOST`, `PORT` | image: `/run/study/app.sock` / `127.0.0.1`, `5185` | Where the server listens |
| `SANDBOX_UID`, `SANDBOX_GID` | unset (image: 61234) | User opencode runs as |
| `ALLOW_READABLE_PATHS` | unset | `1` skips the isolation check |
| `AGENT` | opencode | `fake`: no opencode, no model, no agent UI |
| `OPENCODE_BIN` | `node_modules/.bin/opencode` | opencode binary |
| `AGENT_PORT`, `LIVE_PORT`, `CHECKPOINT_PORT` | `4591`, `4592`, `4593` | Loopback ports |
| `WORK_ROOT`, `AGENT_HOME` | `/work`, `/agent-home` | Trial projects; opencode's home |
| `SESSION_RECORDING` | on | `0` turns the screen recording off |
| `EXIT_ON_FINISH` | on | `0` keeps the server running after Finish |
| `TRY_TRIAL` | unset | `US1,MILESTONE,Flawed` plays that trial in place of the practice story (development) |
| `DEMO`, `SHOW_CONDITION` | off | Demo restarts; condition tag in the UI (never for participants) |

### 10.2 `study-harness/scripts/run-session.sh`

`--participant ID`, `--seed N`, `--group 0-5` (generated when omitted), `--show-condition`, `--demo` (exports go to
`exports-demo/`), `--no-window`, `--no-recording`, `--dry-run`. Loads `LIVE_MODEL`, `LIVE_API_KEY` and
`LIVE_UPSTREAM` from `.env` in the repository root (the environment wins). Builds the image
(`docker build -f study-harness/Dockerfile .`), starts the container, the forwarder, and a browser app window.

### 10.3 Test runs (`live-run.ts`)

`LIVE_API_KEY=... npx tsx src/live-run.ts --story US1 --variant Flawed --regime MILESTONE [--pause 0|1]
[--reject "answer"] [--model ID] [--ports 4890] [--out /tmp/live-runs]` (in `study-harness/server`) plays one story
through real opencode without a participant: it approves, accepts (or rejects and gives the answer), and writes the
events and a summary (checkpoints, commits, whether the flaw landed, tokens, time) to the output folder. Several runs
in parallel need different `--ports`.

## 11. Tests

- `npm test` (root): shared and server unit tests. Server: trials on their reference (§3), the full study flow with
  the fake agent (project on disk and open git changes at every checkpoint, exports), the rejection flow, demo mode,
  telemetry, the proxy filter, the service worker, the live endpoint and the checkpoint server.
- `OPENCODE_IT=1 npm test` also runs `live-opencode.test.ts` with the real opencode binary and a scripted model: the
  practice trial live (Drehbuch only in the request, checkpoint commits and hold, grading as played), and a rejection
  with the one composer message.
- `npm run typecheck`. The study module is type-checked as part of opencode's app (`bun x tsc -b` in `packages/app`
  of the build checkout).

## 12. Maintenance notes

- **Changing a story**: edit its outlines and questions, update `reference/` to code that follows the outline, and run
  `npm test`; then check it with a few `live-run.ts` runs, since the real agent's code is what gets graded.
- **Upgrading opencode**: change the tag in `study-harness/agent-ui/build.sh` and `study-harness/Dockerfile`, and
  `@opencode/cli` in `study-harness/server`. Re-apply `opencode.patch`, run `OPENCODE_IT=1 npm test`, and re-check the
  v2 API calls (`agent.ts`), the MCP config, the blocked-request list, the selectors `study.css` hides, and the DOM
  selectors in `telemetry.ts` (telemetry.md §6).
- **Changing what is recorded**: add the UI event to `UiEvent` (`shared/src/view.ts`), handle it in
  `StudySession.recordUi`, add result fields to `TrialResult` and `CSV_COLUMNS`, and document it in telemetry.md.

## 13. Why it is built this way

Since the supervisor meeting of 29.10 the study no longer replays recorded sessions; a real model plays the agent
live, from the Drehbuch.

**The Drehbuch is added on the way to the model.** The study server's model endpoint appends it to the system prompt
of the trial's main conversation. It is not in `AGENTS.md`, a custom agent or opencode's config, because the
participant's sandboxed terminal can read those, and the Flawed outline would give the condition away.

**The checkpoint is a tool the agent calls.** The Drehbuch makes the agent call `review_checkpoint` after steps 1–3,
in every regime, so the conversation looks the same in all of them. The study decides whether a call returns at once
or is held until the participant has reviewed. The pause therefore does not depend on the model stopping by itself.

**A flaw is a wrong design decision, not a bug order.** Models refuse to plant bugs, mention them, or overdo them.
Instead, the Flawed outline states one plausible but wrong decision that contradicts the user story, and the
Drehbuch says the team's decisions are final. The participant sees only the user story, so the flaw shows up as in
real reviews: as a mismatch between the request and the code.

**Questions are graded on the code as played.** The question texts are fixed; the answer key comes from running the
trial's scripts on the agent's code (the behaviour question when it is asked, the understanding items at the end). If
the code does something no option says, that outcome replaces a distractor. Item 4 of every story asks about
behaviour that holds whatever the code looks like: in US0, US3, US4 and US6 whether the agent's own tests would
notice a given change (the script swaps in the mutant and runs them); in US1, US2 and US5 what the finished route or
middleware answers.

**A rejection goes back to the agent.** After a rejection the agent asks in the chat what to change, the
participant answers once in opencode's own composer, and the agent fixes the step before going on. The answer and
the time to write it are recorded.

**One codebase, a fresh copy per trial.** Every story starts from the same project (`shopfront`), so after the
practice story participants know the codebase; no story's code carries over to the next.

**Planning happens in the background.** The next trial's agent explores and plans while the participant answers
the questionnaire or the previous trial's understanding questions.

### Test runs

DeepSeek V4.1 Flash on OpenCode Go, with `live-run.ts`, over two rounds (13 and 25 runs) plus extra runs of US1:

- **Adherence**: every run kept to the four steps and called the checkpoint after steps 1–3; no pause was missed.
- **Gradeable**: every item's script described the code in every run.
- **Flaw landed**: 15 of 15 Flawed runs outside US1. In US1 about two thirds: the agent sometimes refuses to remove
  sold-out items (about a third of runs), and an earlier version of the flaw (overselling) landed in 4–5 of 10.
- **Rejection**: in three runs with a specific answer (US5 paused, US4 BATCH), the agent asked one question, ended
  its turn, fixed the flaw as asked, called the checkpoint again and passed its tests.
- Planning took 16–52 s per story in a participant session; a whole rejection run, plan included, 1.3–1.5 minutes.
