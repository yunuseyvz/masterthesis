# Deployment: an online study on Conditioner

How the harness runs as an unsupervised online study on [Conditioner](https://github.com/mimuc/conditioner) (private
repository of the LMU group), what was tested and what is still missing. For running one session in the lab, see the
[README](../../README.md).

**Status (7 November 2026).** One practice trial ran through Conditioner in a real browser: real model, plan, pause,
diff, terminal, rejection with the composer, grading. The end of a session (Finish, redirect, exports) was tested with
the fake agent. **The study is not ready for online participants yet:** see "Missing before participants".

## How it fits together

```
participant ──► TLS ──► nginx :8088
                         ├─ /start/<study>?PROLIFIC_PID=…   provisioning: condition, pod, redirect
                         ├─ /study/<study>/<user>/…         the participant's pod (tracker.js added to the page)
                         ├─ /__tracking/…                   ingest → Postgres (input events, rrweb)
                         └─ /__complete/<study>/<user>      completed, pod stopped, redirect

pod = this image, one container and one volume per participant
  study server (root) ── live endpoint ──► litellm:4000 ──► model   (the real key is only in LiteLLM)
  opencode, terminal (uid 61234)        grading (uid 61235)
```

| Harness | Comes from |
|---|---|
| Participant ID, seed | `STUDY_USER_ID` (without dashes; the seed is its hash) |
| Group and round | One Conditioner condition per group × round, 12 in all, through `podman_args` |
| Model key | `STUDY_LLM_KEY`, a LiteLLM key per participant with a budget |
| Path of the app | `/study/<STUDY_SLUG>/<STUDY_USER_ID>/`, filled into the built UI when the server starts |
| Where to go after Finish | `STUDY_COMPLETION_URL` |
| Exports | `EXPORT_DIR=/data/exports`, in the participant's volume, `0700` |

opencode assumes it is at the root of its origin, in its API paths, server key and route checks. So it goes on thinking
that: `agent-ui/study/base.ts` adds the path to requests (`fetch`, `WebSocket`), and `agent-ui/study/router.tsx` to the
address bar. Without a path both do nothing, so `run-session.sh` works as before.

## Set up

Files are in `study-harness/deploy/`. On a Linux host with podman, in a Conditioner checkout:

```sh
git apply <repo>/study-harness/deploy/conditioner.patch
cp <repo>/study-harness/deploy/litellm.yaml deploy/litellm.yaml
node <repo>/study-harness/deploy/make-conditions.mjs > conditions.json
mkdir -p studies/beacon && touch studies/beacon/info.html studies/beacon/consent.html
```

`deploy/.env`: `DB_PASSWORD`, `LITELLM_MASTER_KEY` (starts with `sk-`), `PUBLIC_BASE_URL`, `STUDY_UPSTREAM_KEY` (the
model's key), and `UPSTREAM_HOST`, the gateway of `internal_network` (`podman network inspect internal_network`, for
example `10.89.1.1`). Build the harness (`docker build -f study-harness/Dockerfile -t localhost/beacon:latest .`, then
load it into podman if it was built with Docker) and start the stack as in Conditioner's README.

`LLM_BUDGET_USD` (default 5) has to be added to the `provisioning` service in `docker-compose.yml` to change it. Set
`SESSION_CEILING_SECONDS` there too (default 2 h, see below). Restart nginx after restarting provisioning, because it
resolves that name only once.

## What is needed in Conditioner

Tested with the changes in `conditioner.patch` and `litellm.yaml`. To agree with the people who run Conditioner, since
other studies use it too.

| Finding | Effect | Change |
|---|---|---|
| nginx reaches pods through `host.containers.internal` | Not in Podman's DNS on Linux: every pod answers "starting" for ever | Set `UPSTREAM_HOST` to a gateway address |
| Networks created through compose have `isolate: true` | nginx in `default` cannot reach pods in `internal_network` | nginx joins `internal_network` |
| `proxy_read_timeout 30s` | An agent turn took up to 165 s while the browser waited on its request: the answer would be a "starting" page. An idle terminal would be cut off | `3600s` |
| LiteLLM does not know the model's price | Spend stays 0 after 197,000 tokens, so **no budget ever applies** | `*_cost_per_token` in `litellm.yaml`. Verified: with them a key over budget gets 422 `budget_exceeded` |
| OpenCode Go wants `x-opencode-session` and a user agent of the client's own | 400 without it | Forward `x-` headers for the model group, set `User-Agent` |

### Open security issues in Conditioner

Seen in the running stack. Each matters for an unsupervised study, because a participant has a terminal in a pod.

| Issue | Seen | What to do |
|---|---|---|
| Provisioning API without login on the pods' network | As uid 61234 in a pod: `GET http://provisioning:8180/overview` lists every participant; its `DELETE /provision/…` needs no login either | The egress rule below; tell the people who run Conditioner |
| Ingest and other pods on the same network | `ingest:8181` answered from a pod | The egress rule below |
| Pod ports on all interfaces | `0.0.0.0:20000->5185/tcp`; the harness has no login | Firewall on the host |
| Dashboard, replay and `/internal/resolve` open by default | Conditioner's README warns of this | Its "Before going live" list |
| No TLS | nginx speaks plain HTTP | A reverse proxy in front |
| `/start` without an ID creates a pod per visit | Two visits, two pods; `stop_at_n` is not enforced | Refuse it in nginx |

Postgres is not reachable from pods.

## Security of the pod

| Protection | State |
|---|---|
| The real key stays in LiteLLM; a pod has a budgeted key, unreadable for the sandbox users | Tested |
| `opencode` and the terminal's shell have no key in their environment | Checked on the running processes |
| Grading does not run as root; the project's links, hooks and pipes do no harm | Tested in the image (`sandbox.test.ts`) |
| The model endpoint passes only chat completions for the study's model | Tested in the pod, refusals logged as `live_refused` |
| **Egress rule**: uids 61234 and 61235 may use loopback only | **Proof of concept only**, in an Alpine container under rootful Podman. Not in the image yet |
| Terminal under a uid of its own, without access to ports 4591–4593 | The port rule works in the same proof of concept; the second opencode for it is not built |
| Allowlist for the opencode API in the browser's proxy | Not built (`app.ts`, still a blocklist) |

The egress rule, for the entrypoint, needs `--cap-add NET_ADMIN`, which is dropped afterwards:

```
nft add table inet study
nft 'add chain inet study out { type filter hook output priority 0; policy accept; }'
nft 'add rule inet study out meta skuid { 61234, 61235 } oifname != "lo" reject'
```

Not tested under rootless Podman.

## Running it

Measured in the test: the stack without pods takes about 1 GB; one pod about 600 MB while idle (opencode 320 MB, server
and tsx 280 MB), without a dev server in the terminal or tests running. The 3 GB limit per pod is a ceiling, not a need.
**Several sessions at once have not been tested** (the test host has 7 GB). Plan for a host of 16–32 GB and measure.

Cost and limits, for DeepSeek V4.1 Flash on OpenCode Go at listed prices: about $0.08 (off-peak) to $0.16 (peak) for a
full session of 1.5 M prompt tokens, 85 % cached, and 70,000 completion tokens. The plan allows 20 % of its monthly limit
in 5 hours. The provider's privacy settings and region (DeepSeek needs **Global**) belong in the ethics application.

**The provider's load is a risk for the study.** During the test DeepSeek answered 429 `overloaded` for several minutes,
also without LiteLLM, and later calls took over 30 s. The participant saw a spinner: 231 s for a plan and 165 s for two
steps, with nothing explaining it.

## Missing before participants

| Missing | Why |
|---|---|
| Resume after a restart (plan §7.4) | Seen: a stopped pod comes back at the welcome page, and the log gets a second `session_start`. Idle stop after an hour, stop after 2 h regardless |
| Actions that do not block (plan §7.4) | The longer timeout is a workaround; a dropped connection still leaves the browser waiting |
| Egress rule and API allowlist | See above |
| Errors and slow phases on screen, retries, possibly a second model | See "the provider's load" |
| Consent for what `tracker.js` records | Every key press, mouse, clicks, scrolling, DOM, canvas as images. With `SESSION_RECORDING=0` the harness no longer mentions recording at all, so today's consent text would be **wrong** |
| Collecting the volumes into one `trials.csv` | Each pod writes its own |
| Balance after dropouts | `current_count` counts starts, not completions |
| Load test (5 sessions at once) | Needs a bigger host |

Harmless: the browser logs a failed `/sw.js` under a path. opencode's favicon paths do not get the path.

## How it was tested

Conditioner at `1cd07aa`, on a shared server, so the whole stack ran inside one Docker container with Podman (limit 3 GB,
loopback only) and was removed afterwards. Two things are artefacts of that and not findings: Podman's healthchecks need
systemd, and `docker-compose build` fails through Podman's socket. Whether the network findings above hold identically
on a host without nesting is the first thing to check on the real server.
