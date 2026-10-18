# Beacon study harness

Participants review a scripted AI coding agent in a Claude-Code-Desktop-style workspace (chat, diff review, files, real terminal).

## Run locally (dev, no isolation)

```bash
npm install && npm run build
PARTICIPANT_ID=P1 STUDY_SEED=1 STUDY_GROUP=1 EXPORT_DIR=./exports ALLOW_READABLE_PATHS=1 EXIT_ON_FINISH=0 \
  npx -w server tsx src/main.ts      # http://localhost:5185
```

Flow: welcome → questionnaire (consent, demographics, NCS-6 + attention check, S-TIAS) → practice story (US0, unmeasured) → six measured stories → debrief.

`npm test` validates every story in `server/corpus`: the Correct variant passes its tests and probe, the Flawed variant passes the same tests but gives a different probe answer.

## Run a real session (Docker)

```bash
scripts/run-session.sh   # then open http://localhost:5185
```

With no options the script generates a random alphanumeric participant ID and a random seed, and picks the counterbalancing group from the number of completed sessions in `exports/` (modulo 6). Override with `--participant ID`, `--seed N`, `--group 0-5`; `--dry-run` prints the resolved values without starting anything.

## Isolation model

- The container has no network. It serves on a unix socket; `scripts/forward.mjs` bridges it to `localhost:5185` on the host.
- The server runs as root only to start the participant's shell as uid 61234. `/app` (code and corpus with ground truth) is `0700`, and `exports/` and `.run/<id>` are `0700` on the host, so the shell cannot read variants or answers.
- At startup the server checks (as the sandbox uid, `test -r`) that none of those paths are readable and refuses to start otherwise.
- Without `SANDBOX_UID` (dev) the terminal is NOT isolated.

## Data

`exports/<id>_<seed>.json` (bundle incl. practice trial and survey scores), `exports/<id>_<seed>.events.jsonl` (fsynced event log, includes terminal commands and UI events), `exports/trials.csv`.
