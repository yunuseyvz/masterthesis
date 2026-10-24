# Beacon

Code for a master's thesis study on where a coding agent should pause for review. Participants work with an AI coding
agent in [opencode](https://opencode.ai) v2: the real agent and its own web app, in a study build. The agent replays
a captured session, so every participant sees the same work, and stops for review where the condition says.

| Folder | What |
|---|---|
| `capture/` | The capture tool: records real opencode sessions with a real model ([capture/README.md](capture/README.md)) |
| `captures/` | Captures (recorded or synthetic) |
| `harness/` | The study harness: study server, the study build of opencode's web app, trials, the Docker image |
| `shared/` | Types both use: the capture format, the study's data |
| `docs/` | [technical.md](docs/technical.md), [telemetry.md](docs/telemetry.md), thesis material |
| `scripts/` | Research scripts (benchmarks, rater sheets) |

## Run locally (dev, no isolation)

```bash
npm install && npm run build         # build = harness/agent-ui/build.sh (clones opencode once, ~3 GB install)
PARTICIPANT_ID=P1 STUDY_SEED=1 STUDY_GROUP=1 EXPORT_DIR=./exports ALLOW_READABLE_PATHS=1 EXIT_ON_FINISH=0 \
  WORK_ROOT=/tmp/beacon-work AGENT_HOME=/tmp/beacon-agent \
  npx -w harness/server tsx src/main.ts      # http://localhost:5185
```

`AGENT=fake` plays the captures without opencode (no agent UI), for working on the study flow. `REPLAY_PACE` scales
the recorded timing: `1` (default) as recorded, `2` twice as slow, `0` instant.

## The agent UI (`harness/agent-ui/`)

opencode's web app (`packages/app` of [anomalyco/opencode](https://github.com/anomalyco/opencode), MIT) at a pinned version, plus:

- `study/`: the study module (state from `/_study/state`, the prompt that replaces the composer, the full-screen pages).
- `opencode.patch`: two hooks into upstream, at the app root (`StudyGate`) and in the composer region (`StudyDock`).

`harness/agent-ui/build.sh` clones the pinned version, copies `study/`, applies the patch and builds into `harness/agent-ui/dist` (not in git; the Docker image builds it too). The study server hosts that build and forwards `/api` and `/auth` (including the terminal's websocket) to opencode on loopback, adding opencode's password itself. Study and agent share one origin, and the browser never talks to opencode directly.

Flow: welcome → questionnaire (consent, demographics, NCS-6 + attention check, S-TIAS) → practice story (US0, unmeasured) → six measured stories → preference ranking → debrief.

## How a trial runs

1. The server creates a git repository with the project as the captured session found it and opens an opencode session on it. The capture's first message (the request, in Plan mode) is sent for the participant; the agent explores the code and answers with its plan.
2. **Approve plan** (study panel) sends the capture's approval message. The agent works as recorded: real tool calls (`write`, `edit`, `shell`, ...) that opencode executes, so files appear and tests really run.
3. The agent stops at the scored review: before the first response of the step after the paused one (MILESTONE, NON_MILESTONE), or at the end (BATCH). Steps before a pause are committed as the replay passes them, so opencode's changes view shows exactly the step under review.
4. Accept or reject, then the behaviour question, then optionally reverse the decision. After a pause the reviewed step is committed and the agent finishes the rest.
5. **I've finished reviewing** hides the code; four understanding questions with confidence, then mental effort.

The model behind opencode is the harness's replay endpoint (`harness/server/src/replay.ts`, OpenAI-compatible). It answers each request with the recorded response for the same conversation and position, chunk by chunk with the recorded timing, with the capture's project path changed to the trial's and the trial's variant patch applied. Each trial (`harness/trials/<id>/trial.json`) names its capture, where its four steps start, the variant patch and the questions. The server arms the replay for one turn at a time; outside a turn the agent only points to the study panel.

## Design

Each story's capture is divided into four steps. One step meets the milestone criteria (C1–C3); it is step 1, 2 or 3 depending on the story. Three regimes decide when the participant reviews:

- **BATCH**: one review of the finished feature (reference).
- **MILESTONE**: the agent pauses after the milestone step.
- **NON_MILESTONE**: the agent pauses after one of the two other steps among 1–3, drawn per trial.

Every participant meets each regime × variant cell once (two stories per regime, one Correct and one Flawed). Six groups, a Williams order per group, balance every story across all six cells; N should be a multiple of 6. In three stories the flaw is in the milestone step, in the other three in a non-milestone step.

At the scored review the participant accepts or rejects, then answers one behaviour question about the reviewed step (BATCH: about the flaw step), answered by running the code, and may reverse the decision. The agent then finishes the remaining steps without a decision, so everyone sees every step once. After each story come four understanding questions, one per step, each with a confidence rating, and one mental-effort rating.

`npm test` validates every trial: both variants pass the visible tests; every probe and understanding answer is checked by running the code in both variants; only the probe and question about the flaw step differ between variants.

## Run a real session (Docker)

```bash
harness/scripts/run-session.sh   # opens http://localhost:5185 in an app window (--no-window: URL only)
```

With no options the script generates a random alphanumeric participant ID and a random seed, and picks the counterbalancing group from the number of completed sessions in `exports/` (modulo 6). Override with `--participant ID`, `--seed N`, `--group 0-5`; `--no-recording` turns the screen recording off; `--dry-run` prints the resolved values without starting anything.

## Isolation model

- The study server serves on a unix socket; `harness/scripts/forward.mjs` bridges it to `localhost:5185` on the host. opencode listens on loopback inside the container and is reached only through the study server.
- The server runs as root only to start opencode as uid 61234. opencode's tools and the participant's terminal in opencode therefore run as that user, which owns only the trial repositories (`/work`) and opencode's home (`/agent-home`). `/app` (code, trials and captures, with ground truth) is `0700`, and `exports/` and `.run/<id>` are `0700` on the host.
- At startup the server checks (as the sandbox uid, `test -r`) that none of those paths are readable and refuses to start otherwise.
- Without `SANDBOX_UID` (dev) opencode runs as the server user and is NOT isolated.

## Data

Each session writes to `exports/`:

- `<id>_<seed>.events.jsonl`: the event log, written and fsynced as it happens.
- `<id>_<seed>.recording.jsonl`: the screen recording (rrweb; `--no-recording` turns it off).
- `<id>_<seed>.json` (at Finish): the bundle with session plan, trial results, surveys and event log.
- `trials.csv` (at Finish): one row per measured trial, appended across sessions.

Every column, event and how each measure is computed: [docs/telemetry.md](docs/telemetry.md).

## Documentation

- [docs/technical.md](docs/technical.md): architecture, the capture format and tool, the replay, trials, study flow, opencode integration, agent UI build, isolation, configuration, tests.
- [capture/README.md](capture/README.md): recording sessions.
- [docs/telemetry.md](docs/telemetry.md): what is recorded and how.
