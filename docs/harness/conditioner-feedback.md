# Feedback on Conditioner after a first deployment

**Context.** We used Conditioner (`mimuc/conditioner`, commit `1cd07aa`) to run the Beacon study: a Next.js app in
one pod per participant, under the path prefix `/study/beacon/<user>/`, with a live model behind LiteLLM. The whole
stack ran in a nested container on a shared host and was removed afterwards. One practice trial went through a real
browser: plan, pause, diff, terminal, rejection, grading, finish. This is feedback from using it, not a review of the
codebase.

## What worked well

- **The model fits the study.** Provisioning a pod and a volume per participant, assigning conditions, and routing
  `/study/<study>/<user>/` is exactly what an online study with an interactive app needs.
- **The path prefix works.** nginx strips the prefix and proxies also WebSockets, so a terminal in the browser works.
  Our app adds the prefix back through two small files; no Conditioner change was needed.
- **The integration surface is small.** A study is an image, two HTML files and an entry in `conditions.json`.
  Provisioning is about 600 lines of Python; the rest is nginx and static pages.
- **Per-participant model keys.** Minting a LiteLLM key with a budget per pod is a good default: the provider key never
  enters a pod, and spend is attributable.
- **Lifecycle and completion.** Idle stop, restart with the volume, completion redirect to Qualtrics/Prolific, and
  test pods excluded from assignment all behaved as documented.
- **Tracking comes for free.** `tracker.js` and rrweb are injected into every HTML page, and the dashboard/replay
  make a session inspectable without extra tooling.

## What we had to change or configure

| Change | Why | Where |
|---|---|---|
| nginx joins `internal_network` | On Linux the compose bridges are isolated, so nginx answered "starting" for ever | `deploy/docker-compose.yml` |
| `proxy_read_timeout` 30 s → 3600 s | Agent turns took up to 165 s and idle terminals were cut off | `deploy/nginx.conf` |
| `*_cost_per_token` in `litellm.yaml` | Without prices, spend stayed 0 and no budget ever applied | LiteLLM config |
| Forward `x-opencode-session`, own `User-Agent` | OpenCode Go rejects requests without them | LiteLLM config |

The first two are a two-line patch (`study-harness/deploy/conditioner.patch`). The other two are configuration, not
Conditioner issues.

## Security findings

These matter for any unsupervised study, because every participant has a terminal in a pod. Seen from inside a pod
(uid 61234) on the test stack:

1. **Provisioning API without login on the pods' network.** `GET http://provisioning:8180/overview` lists every
   participant; `DELETE /provision/<study>/<user>` needs no credentials. A participant could enumerate and delete
   other participants' pods.
2. **Ingest reachable from pods.** `ingest:8181` answered. A pod can post events as any participant it names.
3. **Pod ports on all interfaces.** Pods were published as `0.0.0.0:20000->5185`; the app has no login, so the
   firewall on the host is the only barrier.
4. **Dashboard, replay and `/overview` open by default.** The README warns; the commented-out `allow`/`deny` lines are
   easy to miss, and `/internal/resolve` has `internal;` commented out.
5. **No TLS.** nginx speaks plain HTTP; a reverse proxy in front is required.
6. **`/start` without an ID creates a pod per visit.** `stop_at_n`, start and end dates are display-only, so the
   entry point needs protection at the edge.

**Suggested platform-side fixes**, roughly in order of impact:

- Authenticate provisioning, or bind it to an admin network only; a shared token per stack would already stop a pod.
- Default-deny the dashboard and replay, or document an auth proxy as required, not optional.
- Require an ID on `/start` (return 400), and enforce `stop_at_n` if it is meant to stop recruitment.
- Publish pod ports on `127.0.0.1` only, since nginx is the intended entry point.
- Offer a per-study network, so pods of different studies cannot see each other.

We can mitigate part of this inside our image (an egress rule for the sandbox user), but a pod can still reach
sibling pods and platform services on `internal_network`; the platform boundary is the better place.

## Operational friction

- **Seeding only adds.** Changes to a study's conditions or HTML are ignored once it exists; a reset script or an
  `--update` seed would help.
- **Startup is brittle in nested setups.** Healthchecks need systemd and `docker-compose build` fails through
  Podman's socket; the README could say which topologies are supported.
- **Image pull is inside the 60 s `podman run` timeout.** Pre-pulling is necessary and easy to forget.
- **`stop_at_n` counts starts, not completions.** For balanced cells and dropout replacement we need completion
  counts, or a documented way to correct them.
- **Resume is partial.** The container restarts with its volume, but the app inside starts from scratch; that is the
  app's job, and we are building it.
- **Consent pages are stored, not shown.** Fine for us (consent is in the pre-survey), but worth stating in the
  README next to the tracking warning.

## What would help us

- A supported way to isolate a study's pods from each other and from provisioning/ingest.
- An authentication story for the dashboard, or a recommended reverse-proxy config.
- A small hook or documented convention for "app is ready" after a restart (nginx's starting page is good; a health
  endpoint would make it deterministic).
- A documented export path for the per-participant volumes, since each pod writes its own.

## Our side

- We keep the two-line patch small and would be happy to submit it as a PR.
- We will report the security findings to the maintainers separately and can test fixes.
- Our deployment notes, including what was tested and what was not, are in `docs/harness/deployment.md`.

**Caveat.** All findings come from one stack at `1cd07aa`, run nested in a container on a shared host. The network
observations should be re-checked on the real server before they are treated as properties of Conditioner itself.
