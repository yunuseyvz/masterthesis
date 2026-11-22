# Beacon

Code for a master's thesis study on where a coding agent should pause for review. Participants work with an AI coding
agent in [opencode](https://opencode.ai) v2: the real agent and its own web app, in a study build. A real model plays
the agent live, following a hidden script per story (the Drehbuch), and stops for review where the condition says.

| Folder | What |
|---|---|
| `study-harness/` | The study harness: study server, the study build of opencode's web app, the project, the trials, the Docker image |
| `shared/` | The study's types and the session plan generator |
| `docs/` | [Study design](docs/study-design.md), [analysis plan](docs/analysis-plan.md), [stimuli](docs/stimuli.md), [harness](docs/harness.md), [data collected](docs/data.md) |
| `analysis/` | The planned analysis in R (`analyze.R`), fictitious data for it (`design.ts`, `simulate.R`) and the power simulation (`power.R`); the pilot's checks (`pilot/`) |

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
- `npx tsx src/session-run.ts` (in `study-harness/server`) plays a whole session with the real agent and no browser;
  `study-harness/scripts/play-session.py` clicks through a running session in Chromium (Playwright). Both are
  mechanical tests of the flow; their data mean nothing.
- `AGENT=fake` runs the study flow without opencode or a model (no agent UI): the fake agent writes each story's
  reference code. For working on the flow, and in tests.

## Documentation

- [docs/study-design.md](docs/study-design.md): research question, milestone criterion, conditions, hypotheses.
- [docs/analysis-plan.md](docs/analysis-plan.md): the planned analysis, fixed before data collection.
- [docs/stimuli.md](docs/stimuli.md): how stories and questions are made, and the provenance of the existing ones.
- [docs/harness.md](docs/harness.md): how the harness is built, isolation, deployment.
- [docs/data.md](docs/data.md): what is recorded.
