#!/usr/bin/env bash
# One participant session in a fresh, air-gapped container.
# Usage: scripts/run-session.sh <participant-number> [study-seed]
# Group = participant number mod 6, so run participants 1..N in order to keep the design balanced.
set -euo pipefail

N=${1:?participant number}
SEED=${2:-$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')}
ID="P$N"
GROUP=$((N % 6))
ROOT=$(cd "$(dirname "$0")/.." && pwd)
EXPORTS="$ROOT/exports"
RUN="$ROOT/.run/$ID"

# 0700 matters: the participant's shell runs as another uid inside the container and must not be able
# to read exports (they contain every trial's variant) or the control socket.
mkdir -p "$EXPORTS" "$RUN"
chmod 700 "$EXPORTS" "$RUN"
rm -f "$RUN/app.sock"

docker build -q -t beacon-study-harness "$ROOT" >/dev/null

docker run --rm --name "beacon-$ID" \
  --network none \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN --cap-add DAC_OVERRIDE \
  --security-opt no-new-privileges --pids-limit 512 --memory 2g \
  -e PARTICIPANT_ID="$ID" -e STUDY_SEED="$SEED" -e STUDY_GROUP="$GROUP" \
  -v "$EXPORTS:/exports" -v "$RUN:/run/study" \
  beacon-study-harness &
DOCKER_PID=$!

for _ in $(seq 1 100); do [ -S "$RUN/app.sock" ] && break; sleep 0.2; done
[ -S "$RUN/app.sock" ] || { echo "harness did not start" >&2; kill "$DOCKER_PID" 2>/dev/null || true; exit 1; }

node "$ROOT/scripts/forward.mjs" "$RUN/app.sock" 5185 &
FWD_PID=$!
trap 'kill "$FWD_PID" 2>/dev/null || true; docker rm -f "beacon-$ID" >/dev/null 2>&1 || true' EXIT

echo "Session $ID (seed $SEED, group $GROUP) ready: http://localhost:5185"
wait "$DOCKER_PID"
