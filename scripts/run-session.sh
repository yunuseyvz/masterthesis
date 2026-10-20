#!/usr/bin/env bash
# One participant session in a fresh container.
#
# Usage: scripts/run-session.sh [--participant ID] [--seed N] [--group 0-5] [--show-condition] [--offline] [--dry-run]
#
# With no options everything is generated:
#   participant  random 6-character ID (letters/digits, no look-alikes), e.g. K7QX2M
#   seed         random 32-bit integer; drives option shuffles and is part of the export file names
#   group        number of completed sessions in exports/ modulo 6, so groups stay balanced as
#                you run participants one after another, and a dropout's slot is re-run
# Any of them can be set explicitly. --dry-run prints the resolved values and exits.
# --offline runs the container without network (and without the Preview pane).
# --show-condition (experimenter aid, never for real participants) shows "<regime>·<variant>" next to the
# participant ID in the sidebar: regime B = batch (review at the end), M = milestone pause, N = non-milestone pause;
# variant C/F = correct/flawed.
set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }

PARTICIPANT="" SEED="" GROUP="" DRY=0 SHOW=0 OFFLINE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --participant|--seed|--group)
      [ $# -ge 2 ] || { echo "$1 needs a value" >&2; exit 2; }
      case "$1" in --participant) PARTICIPANT=$2;; --seed) SEED=$2;; --group) GROUP=$2;; esac
      shift 2 ;;
    --participant=*) PARTICIPANT=${1#*=}; shift ;;
    --seed=*)        SEED=${1#*=}; shift ;;
    --group=*)       GROUP=${1#*=}; shift ;;
    --dry-run)       DRY=1; shift ;;
    --show-condition) SHOW=1; shift ;;
    --offline)       OFFLINE=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/.." && pwd)
EXPORTS="$ROOT/exports"

if [ -z "$PARTICIPANT" ]; then
  # read a bounded chunk first so tr/head can't trigger SIGPIPE under pipefail
  PARTICIPANT=$(head -c 512 /dev/urandom | LC_ALL=C tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' | head -c 6)
fi
[ -n "$SEED" ] || SEED=$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')
if [ -z "$GROUP" ]; then
  # exports/ may not exist yet on a fresh checkout: that just means zero completed sessions
  DONE=$({ find "$EXPORTS" -maxdepth 1 -name '*.json' 2>/dev/null || true; } | wc -l)
  GROUP=$((DONE % 6))
fi

# The ID ends up in file and container names, so keep it strictly alphanumeric.
[[ "$PARTICIPANT" =~ ^[A-Za-z0-9]{1,32}$ ]] || { echo "participant ID must be 1-32 letters/digits, got '$PARTICIPANT'" >&2; exit 2; }
[[ "$SEED" =~ ^[0-9]{1,10}$ ]]              || { echo "seed must be a non-negative integer, got '$SEED'" >&2; exit 2; }
[[ "$GROUP" =~ ^[0-5]$ ]]                   || { echo "group must be 0-5, got '$GROUP'" >&2; exit 2; }

echo "Participant $PARTICIPANT  seed $SEED  group $GROUP"
[ "$DRY" = 1 ] && exit 0

RUN="$ROOT/.run/$PARTICIPANT"

# 0700 matters: the participant's shell runs as another uid inside the container and must not be able
# to read exports (they contain every trial's variant) or the control socket.
mkdir -p "$EXPORTS" "$RUN"
chmod 700 "$EXPORTS" "$RUN"
rm -f "$RUN/app.sock"

docker build -q -t beacon-study-harness "$ROOT" >/dev/null

# The container has network access by default (the experimenter observes the session). The participant's dev
# server is published on 127.0.0.1:$PREVIEW_PORT for the Preview pane. --offline removes both (no Preview).
PREVIEW_PORT=${PREVIEW_PORT:-3000}
if [ "$OFFLINE" = 1 ]; then NET=(--network none); PREVIEW_URL=""; else NET=(-p "127.0.0.1:$PREVIEW_PORT:3000"); PREVIEW_URL="http://localhost:$PREVIEW_PORT"; fi

docker run --rm --name "beacon-$PARTICIPANT" \
  "${NET[@]}" \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add KILL \
  --security-opt no-new-privileges --pids-limit 512 --memory 3g \
  -e PARTICIPANT_ID="$PARTICIPANT" -e STUDY_SEED="$SEED" -e STUDY_GROUP="$GROUP" -e SHOW_CONDITION="$SHOW" -e PREVIEW_URL="$PREVIEW_URL" \
  -v "$EXPORTS:/exports" -v "$RUN:/run/study" \
  beacon-study-harness &
DOCKER_PID=$!

for _ in $(seq 1 100); do [ -S "$RUN/app.sock" ] && break; sleep 0.2; done
[ -S "$RUN/app.sock" ] || { echo "harness did not start" >&2; kill "$DOCKER_PID" 2>/dev/null || true; exit 1; }

node "$ROOT/scripts/forward.mjs" "$RUN/app.sock" 5185 &
FWD_PID=$!
trap 'kill "$FWD_PID" 2>/dev/null || true; docker rm -f "beacon-$PARTICIPANT" >/dev/null 2>&1 || true; rm -f "$RUN/app.sock"' EXIT

echo "Session ready: http://localhost:5185"
wait "$DOCKER_PID"
