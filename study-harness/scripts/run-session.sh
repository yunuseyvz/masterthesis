#!/usr/bin/env bash
# One participant session in a fresh container.
#
# Usage: study-harness/scripts/run-session.sh [--participant ID] [--seed N] [--group 0-5] [--round N] [--show-condition] [--demo] [--no-window] [--no-recording] [--dry-run]
#
# With no options everything is generated:
#   participant  random 6-character ID (letters/digits, no look-alikes), e.g. K7QX2M
#   seed         random 32-bit integer; drives option shuffles and is part of the export file names
#   group        number of completed sessions in exports/ modulo 6, so groups stay balanced as
#                you run participants one after another, and a dropout's slot is re-run
#   round        completed sessions of that group in exports/; alternates the NON_MILESTONE pause step
# Any of them can be set explicitly. --dry-run prints the resolved values and exits.
# --show-condition (experimenter aid, never for real participants) shows "<regime>·<variant>" next to the
# participant ID in the sidebar: regime B = batch (review at the end), M = milestone pause, N = non-milestone pause;
# variant C/F = correct/flawed.
# The study opens in its own app window (a browser in app mode: no address bar or tabs, like a desktop app);
# --no-window only prints the URL.
# The screen is recorded (rrweb, exports/<ID>_<seed>.recording.jsonl); --no-recording turns that off.
# --demo (for showing the harness, never for real participants) keeps the container running: after Finish a fresh
# session with a new ID starts, and the last screen offers "Start again". Demo exports go to exports-demo/.
set -euo pipefail

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

PARTICIPANT="" SEED="" GROUP="" ROUND="" DRY=0 SHOW=0 DEMO=0 WINDOW=1 RECORD=1
while [ $# -gt 0 ]; do
  case "$1" in
    --participant|--seed|--group|--round)
      [ $# -ge 2 ] || { echo "$1 needs a value" >&2; exit 2; }
      case "$1" in --participant) PARTICIPANT=$2;; --seed) SEED=$2;; --group) GROUP=$2;; --round) ROUND=$2;; esac
      shift 2 ;;
    --participant=*) PARTICIPANT=${1#*=}; shift ;;
    --seed=*)        SEED=${1#*=}; shift ;;
    --group=*)       GROUP=${1#*=}; shift ;;
    --round=*)       ROUND=${1#*=}; shift ;;
    --dry-run)       DRY=1; shift ;;
    --show-condition) SHOW=1; shift ;;
    --demo)          DEMO=1; shift ;;
    --no-window)     WINDOW=0; shift ;;
    --no-recording)  RECORD=0; shift ;;
    -h|--help)       usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# The repository root: exports and per-session sockets live there; the image is built from it.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
# Demo sessions are kept apart so they never count towards the real participants' group balance.
if [ "$DEMO" = 1 ]; then EXPORTS="$ROOT/exports-demo"; else EXPORTS="$ROOT/exports"; fi

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
if [ -z "$ROUND" ]; then
  # completed sessions (bundles) of this group so far
  ROUND=$(node -e '
    const fs = require("fs"), path = require("path"), [dir, g] = process.argv.slice(1);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    console.log(files.filter((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).plan?.group === Number(g)).length);
  ' "$EXPORTS" "$GROUP")
fi

# The ID ends up in file and container names, so keep it strictly alphanumeric.
[[ "$PARTICIPANT" =~ ^[A-Za-z0-9]{1,32}$ ]] || { echo "participant ID must be 1-32 letters/digits, got '$PARTICIPANT'" >&2; exit 2; }
[[ "$SEED" =~ ^[0-9]{1,10}$ ]]              || { echo "seed must be a non-negative integer, got '$SEED'" >&2; exit 2; }
[[ "$GROUP" =~ ^[0-5]$ ]]                   || { echo "group must be 0-5, got '$GROUP'" >&2; exit 2; }
[[ "$ROUND" =~ ^[0-9]{1,4}$ ]]              || { echo "round must be a non-negative integer, got '$ROUND'" >&2; exit 2; }

echo "Participant $PARTICIPANT  seed $SEED  group $GROUP  round $ROUND$([ "$DEMO" = 1 ] && echo "  (demo)")"
[ "$DRY" = 1 ] && exit 0

RUN="$ROOT/.run/$PARTICIPANT"

# 0700 matters: the agent and the participant's terminal run as another uid inside the container and must not be
# able to read exports (they contain every trial's variant) or the control socket.
mkdir -p "$EXPORTS" "$RUN"
chmod 700 "$EXPORTS" "$RUN"
rm -f "$RUN/app.sock"

docker build -q -f "$ROOT/study-harness/Dockerfile" -t beacon-study-harness "$ROOT" >/dev/null

# The container has network access (the experimenter observes the session). The study page, which is opencode's
# web app in study mode, is reached through the unix socket below; opencode itself is not published.

docker run --rm --name "beacon-$PARTICIPANT" \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add KILL \
  --security-opt no-new-privileges --pids-limit 512 --memory 3g \
  -e PARTICIPANT_ID="$PARTICIPANT" -e STUDY_SEED="$SEED" -e STUDY_GROUP="$GROUP" -e STUDY_ROUND="$ROUND" -e SHOW_CONDITION="$SHOW" -e DEMO="$DEMO" -e SESSION_RECORDING="$RECORD" \
  -v "$EXPORTS:/exports" -v "$RUN:/run/study" \
  beacon-study-harness &
DOCKER_PID=$!

for _ in $(seq 1 100); do [ -S "$RUN/app.sock" ] && break; sleep 0.2; done
[ -S "$RUN/app.sock" ] || { echo "harness did not start" >&2; kill "$DOCKER_PID" 2>/dev/null || true; exit 1; }

node "$ROOT/study-harness/scripts/forward.mjs" "$RUN/app.sock" 5185 &
FWD_PID=$!
trap 'kill "$FWD_PID" 2>/dev/null || true; docker rm -f "beacon-$PARTICIPANT" >/dev/null 2>&1 || true; rm -f "$RUN/app.sock"' EXIT

URL="http://localhost:5185"
echo "Session ready: $URL"

# App mode gives opencode a window of its own, which looks like the desktop app.
open_window() {
  if grep -qi microsoft /proc/version 2>/dev/null; then
    # WSL: Edge is always installed on Windows
    cmd.exe /c start msedge "--app=$URL" >/dev/null 2>&1
  elif [ "$(uname)" = Darwin ]; then
    open -na "Google Chrome" --args "--app=$URL" 2>/dev/null || open "$URL"
  else
    for b in chromium chromium-browser google-chrome microsoft-edge; do
      command -v "$b" >/dev/null && { "$b" "--app=$URL" >/dev/null 2>&1 & return; }
    done
    xdg-open "$URL" >/dev/null 2>&1 || true
  fi
}
[ "$WINDOW" = 1 ] && open_window
wait "$DOCKER_PID"
