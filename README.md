# Beacon

Code for a master's thesis study on where a coding agent should pause for review. Participants work with an AI coding
agent in [opencode](https://opencode.ai) v2: the real agent and its own web app, in a study build. A real model plays
the agent live, following a hidden script per story (the Drehbuch), and stops for review where the condition says.

| Folder | What |
|---|---|
| `study-harness/` | The study harness: study server, the study build of opencode's web app, the project, the trials, the Docker image |
| `shared/` | The study's types and the session plan generator |
| `docs/` | [technical.md](docs/technical.md), [telemetry.md](docs/telemetry.md), [analysis-plan.md](docs/analysis-plan.md), [scenario.md](docs/scenario.md), thesis material |
| `analysis/` | The planned analysis in R (`analyze.R`), fictitious data for it (`design.ts`, `simulate.R`) and the power simulation (`power.R`) |
| `scripts/` | Research scripts (benchmarks) |

## Run a session (Docker)

```bash
study-harness/scripts/run-session.sh   # opens http://localhost:5185 in an app window (--no-window: URL only)
```

The model comes from `.env` in the repository root (ignored by git):

```
LIVE_MODEL=deepseek-v4.1-flash
LIVE_API_KEY=...
# LIVE_UPSTREAM=...   an OpenAI-compatible API other than OpenCode Go
```

With no options the script generates a random participant ID and seed, and picks the counterbalancing group from the
number of completed sessions in `exports/` (modulo 6). Override with `--participant ID`, `--seed N`, `--group 0-5`;
`--no-recording` turns the screen recording off; `--dry-run` prints the resolved values without starting anything.

## Run locally (development, no isolation)

```bash
npm install && npm run build         # build = study-harness/agent-ui/build.sh (clones opencode once, ~3 GB install)
set -a; . ./.env; set +a
PARTICIPANT_ID=P1 STUDY_SEED=1 STUDY_GROUP=1 EXPORT_DIR=./exports ALLOW_READABLE_PATHS=1 EXIT_ON_FINISH=0 \
  WORK_ROOT=/tmp/beacon-work AGENT_HOME=/tmp/beacon-agent \
  npx -w study-harness/server tsx src/main.ts      # http://localhost:5185
```

- `TRY_TRIAL=US1,MILESTONE,Flawed` puts one trial in place of the practice story.
- `npx tsx src/live-run.ts --story US1 --variant Flawed` (in `study-harness/server`) plays one story without a
  participant and reports how the agent kept to the Drehbuch.
- `AGENT=fake` runs the study flow without opencode or a model (no agent UI): the fake agent writes each story's
  reference code. For working on the flow, and in tests.

## How a trial runs

1. Every trial starts from a fresh copy of the same project (`study-harness/project`, a small Next.js shop). The
   story's request is sent for the participant in Plan mode, in the background while the participant is on the
   previous page; the agent explores the code and answers with its plan.
2. **Approve plan** sends "The plan looks good. Go ahead." The agent implements four steps with real tool calls.
3. After each of steps 1–3 the agent calls the `review_checkpoint` tool. Steps before the scored one are committed;
   the scored call is held, so the agent waits and the changes view shows exactly that step (BATCH: the review comes
   at the end).
4. Accept or reject, then the behaviour question, then optionally reverse the decision. After an acceptance the agent
   finishes the rest. After a rejection it asks what to change, the participant answers once in opencode's composer,
   and it fixes the step before going on.
5. **I've finished reviewing** hides the code; four understanding questions with confidence, then mental effort.
   Answers are graded by running the trial's scripts on the code the agent wrote.

The model behind opencode is the study server's live endpoint: a proxy in front of the real model that adds the
trial's Drehbuch (`study-harness/trials/drehbuch.md` plus the story's step outline for the variant) to the system
prompt of the trial's conversation. The Drehbuch is in no file opencode or the participant's terminal can read.

Flow: welcome → questionnaire (consent, demographics, NCS-6 + attention check, S-TIAS) → practice story (US0,
unmeasured) → six measured stories → preference ranking → debrief.

## Design

Each story has four steps. One meets the milestone criteria (C1–C3); it is step 1, 2 or 3 depending on the story.
Three regimes decide when the participant reviews:

- **BATCH**: one review of the finished feature (reference).
- **MILESTONE**: the agent pauses after the milestone step.
- **NON_MILESTONE**: the agent pauses after one of the two other steps among 1–3, drawn per trial.

Every participant meets each regime × variant cell once (two stories per regime, one Correct and one Flawed). Six
groups, a Williams order per group, balance every story across all six cells; N should be a multiple of 6. In the
Flawed variant the step outline contains one wrong design decision; in three stories it is in the milestone step, in
the other three in a non-milestone step.

`npm test` checks every trial against its reference implementation: the Correct variant passes the visible tests,
every probe and understanding answer is what the code prints in both variants, and only the questions about the flaw
step differ between variants.

## Isolation model

- The study server serves on a unix socket; `study-harness/scripts/forward.mjs` bridges it to `localhost:5185` on
  the host. opencode listens on loopback inside the container and is reached only through the study server.
- The server runs as root only to start opencode as uid 61234. opencode's tools and the participant's terminal run as
  that user, which owns only the trial repositories (`/work`) and opencode's home (`/agent-home`). `/app` (code and
  trials, with outlines and answer keys) is `0700`, and `exports/` and `.run/<id>` are `0700` on the host.
- At startup the server checks (as the sandbox uid, `test -r`) that none of those paths are readable and refuses to
  start otherwise.
- The terminal can reach the model endpoint and the checkpoint server over loopback; accepted, since sessions are
  supervised.
- Without `SANDBOX_UID` (dev) opencode runs as the server user and is NOT isolated.

## Data

Each session writes to `exports/`:

- `<id>_<seed>.events.jsonl`: the event log, written and fsynced as it happens.
- `<id>_<seed>.recording.jsonl`: the screen recording (rrweb; `--no-recording` turns it off).
- `<id>_<seed>.json` (at Finish): the bundle with session plan, trial results, surveys and event log.
- `trials.csv` (at Finish): one row per measured trial, appended across sessions.

## Documentation

- [docs/technical.md](docs/technical.md): architecture, trials, the live agent, study flow, opencode, agent UI,
  isolation, configuration, tests.
- [docs/concept-live-agent.md](docs/concept-live-agent.md): why the agent is set up this way, test runs, open points.
- [docs/telemetry.md](docs/telemetry.md): every column, event and how each measure is computed.
- [docs/data-collected.md](docs/data-collected.md): German overview of the data, direct and telemetry.
- [docs/analysis-plan.md](docs/analysis-plan.md): hypotheses, models, exclusions.
- [docs/briefing.md](docs/briefing.md): what the experimenter says before and after a session.
- [docs/scenario.md](docs/scenario.md): a fictitious study run end to end, and the power simulation.
