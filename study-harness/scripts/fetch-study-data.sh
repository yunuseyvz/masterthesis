#!/bin/sh
# Fetches the study data from code-pause over SSH (needs eduVPN). First copies the latest exports out of the pod
# volumes on the VM (study-backup.sh collect, which also reports completed sessions without a result file), then
# copies ~/exports and ~/backups to DEST. Never deletes anything in DEST.
#
# Usage: fetch-study-data.sh [DEST]    DEST defaults to ~/study-data; keep it outside the repository.
# STUDY_HOST overrides the SSH host (default: code-pause, as in ~/.ssh/config).
set -eu
HOST=${STUDY_HOST:-code-pause}
DEST=${1:-$HOME/study-data}

mkdir -p "$DEST"
chmod 700 "$DEST"
ssh "$HOST" bin/study-backup.sh collect
rsync -a --no-owner --no-group "$HOST:exports/" "$DEST/exports/"
rsync -a --no-owner --no-group "$HOST:backups/" "$DEST/backups/"
echo "fetched to $DEST: $(ls "$DEST/exports" | wc -l) participants, newest backup $(ls "$DEST/backups" | grep '^provisioning-' | sort | tail -1)"
