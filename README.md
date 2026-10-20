# Beacon study harness

Participants review a scripted AI coding agent in a Claude-Code-Desktop-style workspace (chat, diff review, files, real terminal).

## Run locally (dev, no isolation)

```bash
npm install && npm run build
PARTICIPANT_ID=P1 STUDY_SEED=1 STUDY_GROUP=1 EXPORT_DIR=./exports ALLOW_READABLE_PATHS=1 EXIT_ON_FINISH=0 \
  npx -w server tsx src/main.ts      # http://localhost:5185
```

Flow: welcome → questionnaire (consent, demographics, NCS-6 + attention check, S-TIAS) → practice story (US0, unmeasured) → six measured stories → preference ranking → debrief.

## Design

Each story is built by the scripted agent in four steps. One step meets the milestone criteria (C1–C3); it is step 1, 2 or 3 depending on the story. Three regimes decide when the participant reviews:

- **BATCH**: one review of the finished feature (reference).
- **MILESTONE**: the agent pauses after the milestone step.
- **NON_MILESTONE**: the agent pauses after one of the two other steps among 1–3, drawn per trial.

Every participant meets each regime × variant cell once (two stories per regime, one Correct and one Flawed). Six groups, a Williams order per group, balance every story across all six cells; N should be a multiple of 6. In three stories the flaw is in the milestone step, in the other three in a non-milestone step.

At the scored review the participant accepts or rejects, then answers one behaviour question about the reviewed step (BATCH: about the flaw step), answered by running the code, and may reverse the decision. The remaining steps are then shown without a decision, so everyone sees every step once. After each story come four understanding questions, one per step, each with a confidence rating, and one mental-effort rating.

`npm test` validates every story in `server/corpus`: both variants pass the visible tests; every probe and understanding answer is checked by running the code in both variants; only the probe and question about the flaw step differ between variants.

## Run a real session (Docker)

```bash
scripts/run-session.sh   # then open http://localhost:5185
```

With no options the script generates a random alphanumeric participant ID and a random seed, and picks the counterbalancing group from the number of completed sessions in `exports/` (modulo 6). Override with `--participant ID`, `--seed N`, `--group 0-5`; `--dry-run` prints the resolved values without starting anything.

## Isolation model

- The container has network access by default (the experimenter observes the session; `--offline` turns it off, which also disables the Preview pane). The participant's dev server (port 3000) is published on `127.0.0.1` for the Preview pane. The harness itself serves on a unix socket; `scripts/forward.mjs` bridges it to `localhost:5185` on the host.
- The server runs as root only to start the participant's shell as uid 61234. `/app` (code and corpus with ground truth) is `0700`, and `exports/` and `.run/<id>` are `0700` on the host, so the shell cannot read variants or answers.
- At startup the server checks (as the sandbox uid, `test -r`) that none of those paths are readable and refuses to start otherwise.
- Without `SANDBOX_UID` (dev) the terminal is NOT isolated.

## Data

Each finished session writes three files to `exports/`:

- `<id>_<seed>.json`: the full bundle (session plan, six measured trials, practice trial, surveys, event log).
- `<id>_<seed>.events.jsonl`: the event log, written and fsynced as it happens, so a crash loses at most one event.
- `trials.csv`: one row per measured trial, appended across sessions.

### Per trial (`trials.csv`, `bundle.trials`)

| Column | Meaning |
|---|---|
| `participant_id`, `study_seed`, `group` | Session identity and counterbalancing group (0–5) |
| `position`, `story` | Order in the session (1–6) and story id |
| `regime`, `variant` | BATCH / MILESTONE / NON_MILESTONE; Correct / Flawed |
| `milestoneStep`, `pauseStep`, `probeStep` | Step that meets the criteria; step after which the scored review happened (BATCH: 4); step the behaviour question asked about |
| `initialDecision`, `finalDecision`, `decisionReversed` | Accept/reject before and after the behaviour question |
| `stage1DwellMs` | Time from the review being on screen (after the agent replay) to the first decision |
| `diffScrollCoverage` | Share of the diff scrolled through before deciding (0–1) |
| `testRunsStage1` | Test commands run in the terminal before deciding |
| `stage2ProbeLatencyMs`, `probeAnswer`, `probeCorrect` | Time to answer the behaviour question, chosen option (-1 = don't know), correct by execution |
| `understandingScore` | Correct understanding answers (0–4) |
| `uK_answer`, `uK_correct`, `uK_confidence`, `uK_milestone` | Per understanding item K (= agent step K): chosen option, correct, confidence (50–100 %), whether step K is the milestone |
| `paas` | Mental effort for the story (1–9) |

### Surveys (`bundle.survey`)

- **Before**: consent, demographics (age group, programming experience, AI-assistant use, code-review frequency, TypeScript familiarity), NCS-6 (scored mean, items 3–4 reverse-keyed), attention check (pass/fail), S-TIAS (mean), duration.
- **After**: ranking of the two styles participants can tell apart (review at the end vs. a pause partway through), optional comment, duration.

### Event log

Timestamped events for the whole session: survey screens and submissions, trial start (with regime, variant, milestone and pause step), each checkpoint shown and ready (agent replay time), decisions, behaviour-question answers (including the executed answer), wrap-up dwell, every terminal command and terminal open, and UI events while code is on screen (file opened, tab switched, diff file expanded/collapsed, preview navigation). The bundle can be re-derived from this log.
