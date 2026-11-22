# Study harness

Participants work in [opencode](https://opencode.ai) v2 (its own web app, in a study build). A real model plays the
agent live. The study server sits between opencode and the model: it adds a hidden script per story (the
**Drehbuch**) to the agent's system prompt and serves a `review_checkpoint` tool that it holds while the participant
reviews.

```
browser ── HTTP/WS ──► study server (Fastify)
                         ├─ /_study/*   study API, telemetry, recording
                         ├─ /api, /auth proxy to opencode (blocklist, password)
                         └─ /*          agent-ui/dist (the web app)
                       opencode serve (sandbox uid) ──► live endpoint ──► model
                         └─ review_checkpoint (MCP) ── held while the participant reviews
```

## Layout

| Path | Contents |
|---|---|
| `shared/src/` | Session plan, trial results, UI events, seeded PRNG |
| `study-harness/server/src/` | `machine.ts` state machine, `live.ts` model endpoint, `checkpoint.ts`, `agent.ts` (opencode host), `workspace.ts`, `runner.ts` (grading), `export.ts` |
| `study-harness/agent-ui/` | Study module and patch for opencode's web app |
| `study-harness/trials/` | `drehbuch.md` and one folder per story: `trial.json`, outlines, probes, understanding scripts, `reference/` |
| `study-harness/project/` | The Next.js project every trial starts from |
| `study-harness/scripts/` | `run-session.sh`, `forward.mjs`, `play-session.py` |
| `study-harness/deploy/` | Conditioner patch, LiteLLM config, condition generator |
| `analysis/` | Analysis, simulation and power code |

## How a trial runs

1. A fresh copy of the project is created. The brief is sent in Plan mode in the background; the participant sees the
   story's public plan, not the model's.
2. **Approve plan** starts the build. The agent works in four steps and calls `review_checkpoint` after steps 1–3.
3. Depending on the condition the call returns at once or is held. When held, the changes view shows exactly that
   step. BATCH reviews once at the end.
4. Accept or reject, behaviour question, optionally reverse. After a rejection the agent asks what to change, the
   participant answers once in opencode's composer, and the agent fixes the step.
5. Five understanding questions with confidence, then mental effort. Answers are graded by running the trial's scripts
   on the code the agent wrote.

Session flow: welcome → questionnaire → practice story → six stories → preference ranking → debrief.

## Design decisions

- **The Drehbuch is added on the way to the model**, not in `AGENTS.md` or opencode's config, because the
  participant's terminal can read those.
- **The checkpoint is a tool**, called in every condition, so the conversation looks the same everywhere and the pause
  does not depend on the model stopping by itself.
- **A flaw is a wrong design decision**, stated as the team's final decision, not a planted bug. Models refuse or
  overdo bugs.
- **The plan on screen is fixed text.** A model-written plan leaks instructions and differs between variants.
- **Questions are graded on the code as played.** If the code does something no option says, that outcome replaces a
  distractor.

## Isolation

- The server runs as root only to start opencode as a sandbox uid, which owns only the trial repositories and
  opencode's home. Code, trials, answer keys and exports are `0700`.
- Grading runs the participant's code as a third uid, in a private directory, with an empty environment.
- The server reads project files as their owner and gives git no environment; the participant controls links, hooks
  and git config.
- At startup the server verifies the paths are unreadable and refuses to start otherwise.
- Known gap: the terminal can reach the model endpoint and checkpoint server over loopback. Acceptable when
  supervised; an egress rule is needed online.

## Running

```bash
study-harness/scripts/run-session.sh            # one session in a container
npm install && npm run build                    # local development, no isolation
npm test                                        # unit and flow tests; OPENCODE_IT=1 adds real-opencode tests
```

Key environment variables: `PARTICIPANT_ID`, `STUDY_SEED`, `STUDY_GROUP`, `LIVE_MODEL`, `LIVE_API_KEY`,
`LIVE_UPSTREAM`, `EXPORT_DIR`, `SANDBOX_UID`, `PROBE_UID`, `AGENT=fake` (no model, for tests). All of them are read in
`study-harness/server/src/main.ts`.

**Inactivity limits** protect the server from sessions nobody is at (minutes, `0` = off):

| Variable | Default | Effect |
|---|---|---|
| `STUDY_AFK_WARN_MIN` | 10 | Without input while it is the participant's turn (not while the agent works), "Are you still there?" appears; Continue resets it |
| `STUDY_AFK_ABORT_MIN` | 10 | Without an answer to that prompt, the session ends (`session_abandoned`): end page, sandbox processes killed, no bundle, so it does not count towards the group balance. At the debrief it is exported as after Finish |
| `STUDY_MAX_SESSION_MIN` | 120 | Hard cap in every phase, also while the agent works |

A closed window ends the same way. Conditioner's own idle stop is only the second line.

`study-harness/server/src/live-run.ts` plays one story against the real model without a participant.

## Changing things

- **A story:** edit its outlines, public plan and questions, update `reference/`, run `npm test`, then check with a few
  `live-run.ts` runs.
- **opencode version:** change the tag in `agent-ui/build.sh` and the `Dockerfile`, re-apply `opencode.patch`, run
  `OPENCODE_IT=1 npm test`, and re-check the DOM selectors in `agent-ui/study/telemetry.ts`.

## Online deployment (Conditioner)

The harness runs as one container per participant behind [Conditioner](https://github.com/mimuc/conditioner) (private
LMU repository), with a LiteLLM gateway holding the real model key. Files are in `study-harness/deploy/`
(`conditioner.patch`, `litellm.yaml`, `make-conditions.mjs`: 12 conditions, group × round).

Still missing before participants: an egress rule for the sandbox uids, an allowlist for opencode's API, resume after a
restart, consent text matching what is recorded, collecting per-pod exports, and a load test with several sessions.
