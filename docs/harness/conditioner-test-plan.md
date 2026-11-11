# Testing the study on Conditioner

A practical order for testing the whole stack, from the platform to one finished session. The levels before this
(the automated tests, a scripted session, a browser session on `localhost`) do not exercise Conditioner. Run this on a
test server, not on the shared host; the stack plus one pod needs about 2 GB.

**Legend.** `$COND` is the Conditioner checkout, `$REPO` this repository, `$HOST` the test server.

## 0. What has to be ready

- Linux host with Podman and `podman compose`; Podman socket available (`/run/podman/podman.sock`, or
  `PODMAN_SOCKET` for rootless).
- A DNS name and TLS in front of nginx for the final check (`https://study.example.org`), or a hosts entry for a
  first smoke test.
- The model key for LiteLLM (`STUDY_UPSTREAM_KEY`) and a `LITELLM_MASTER_KEY` starting with `sk-`.
- The image built as `localhost/beacon:latest`, and pre-pulled in Podman (a pull inside `podman run` has 60 s).

```bash
# in $REPO
docker build -f study-harness/Dockerfile -t localhost/beacon:latest .
docker save localhost/beacon:latest | podman load
# or build directly with Podman
podman build -f study-harness/Dockerfile -t localhost/beacon:latest .
```

## 1. Set up the stack

```bash
cd $COND
git apply $REPO/study-harness/deploy/conditioner.patch       # nginx network + read timeout
cp $REPO/study-harness/deploy/litellm.yaml deploy/litellm.yaml
node $REPO/study-harness/deploy/make-conditions.mjs 'https://qualtrics.example/…' > conditions.json   # post-survey, or omit
mkdir -p studies/beacon
# real texts, not empty:
$EDITOR studies/beacon/info.html studies/beacon/consent.html
```

`deploy/.env`:

```
DB_PASSWORD=...
LITELLM_MASTER_KEY=sk-...
PUBLIC_BASE_URL=https://study.example.org
STUDY_UPSTREAM_KEY=...
UPSTREAM_HOST=<gateway of internal_network, e.g. 10.89.1.1>
```

Add to the `provisioning` service in `deploy/docker-compose.yml` if you want other values than the defaults:

```yaml
LLM_BUDGET_USD: "5"
SESSION_CEILING_SECONDS: "7200"
```

Start it as in Conditioner's README:

```bash
alias dc='podman compose -f deploy/docker-compose.yml --env-file deploy/.env'
dc up -d db
dc exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE litellm;"'   # first run only
dc up -d
dc restart provisioning
curl -s localhost:8180/studies          # ["beacon"]
curl -s localhost:8180/conditions/beacon
```

**Pass:** `beacon` is listed with twelve conditions, nginx answers, LiteLLM is healthy. If provisioning fails, read
`dc logs provisioning`; a missing HTML file or invalid `conditions.json` stops the seed.

## 2. One test pod, no participant

```bash
curl -X POST 'localhost:8180/provision/beacon/alice?test=true'
open http://localhost:8088/study/beacon/alice/     # or curl -I
```

**Pass:** the page loads under the prefix, assets and API work, the terminal opens, and the study starts at the
consent page. Test pods do not count toward assignment.

## 3. One complete session through the real entry

Use a fake recruitment ID so `/start` is exercised:

```
http://localhost:8088/start/beacon?PROLIFIC_PID=TEST0001
```

Walk through or let `study-harness/scripts/play-session.py` do it:

```bash
python3 $REPO/study-harness/scripts/play-session.py \
  --url "http://localhost:8088/study/beacon/<user>/" --shots /tmp/conditioner-shots
```

(The script needs the user id from the redirect; `/start` prints or redirects to it.)

**Pass:** practice and six features, five questions each, postsurvey, debrief, Finish; the browser is sent to the
completion URL; `/__complete/beacon/<user>` marks the user completed and stops the pod. The export (bundle, events,
`trials.csv`) is in the pod's volume under `/data/exports`.

## 4. Assignment and balance

```bash
for i in $(seq 1 6); do curl -s "localhost:8088/start/beacon?PROLIFIC_PID=T$i" -o /dev/null; done
curl -s localhost:8180/overview | jq '.studies[0].conditions[] | {name: .condition_name, count: .current_count}'
```

**Pass:** the counts spread over the twelve conditions. With 36 starts, exactly three per condition; with 30, six
cells get three and six get two, and whether every group ends with five depends on which cells those are (see the
notes on N in `docs/study/analysis-plan.md`).

## 5. Telemetry and replay

- `tracker.js` is in the page source, `window.__STUDY__` is set.
- Open the dashboard (`/dashboard/`) and the replay of the test user; the session appears.
- In Postgres: `activity_events` and `recording_chunks` rows for the user.
- The harness export contains `u1_role`…`u5_role`, `featureComplete`, `pauseMissed`.

**Pass:** both data sets exist and can be joined by the user id (the export uses it without dashes).

## 6. Lifecycle

- Set `idle_timeout_seconds` to 120 s for one test condition or wait for the configured hour.
- Leave the pod idle; it stops, the next request through `/study/...` restarts it with its volume.
- Check `/overview`: status `stopped` → `running`, `session_start` updated.
- Wait for `SESSION_CEILING_SECONDS` (2 h default): the pod stops regardless of activity.

**Pass (expected today):** the container restarts, but the study starts at the welcome page. That is the missing
resume, not a Conditioner bug; note it as a finding.

## 7. Security checks

From inside a pod (the terminal or `podman exec -u 61234`):

```bash
node -e "fetch('http://provisioning:8180/overview').then(r=>r.text()).then(console.log)"
node -e "fetch('http://ingest:8181/').then(r=>console.log(r.status))"
```

On the host:

```bash
ss -ltnp | grep -E ':(8088|8180|8181|20000)'   # pod ports on 0.0.0.0?
curl -I http://localhost:8088/dashboard/         # 200 without login?
curl -I http://localhost:8088/__tracking/tracker.js
curl -i 'http://localhost:8088/start/beacon'     # creates a pod without an ID?
curl -I https://study.example.org                # TLS?
```

**Pass in the current state:** several of these fail (the findings in
`docs/harness/conditioner-feedback.md`). The point of the test is to confirm which are still open after the fixes,
not to assume they are.

## 8. Load and failure

- Start 3–5 pods at once and keep them open; watch memory (`podman stats`) and response times.
- Stop LiteLLM: `/start` should fail with 502, since no key can be minted.
- Return 429 from the provider (or use a bad key): the UI must show waiting, not a broken page; the run continues
  when the provider recovers.
- Kill a pod while the browser is open: the next request starts it again (after resume is built, at the right place).

## 9. Collect the data

```bash
podman volume ls | grep beacon
podman volume export beacon-alice-data --output alice.tar
tar -tf alice.tar | grep exports
```

**Pass:** the bundle, the event log and `trials.csv` are in the archive; the CSV has the new columns; the ids can be
mapped to the questionnaire.

## 10. Clean up

```bash
dc down                      # keeps volumes
dc down -v                   # deletes the test database and volumes: only for a test stack
```

Remove test users from the dashboard or with `DELETE /provision/beacon/<user>?test_only=true`; this also removes
their volume.
