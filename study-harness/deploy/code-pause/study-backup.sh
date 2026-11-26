#!/bin/sh
# Runs on code-pause as the code-pause user, nightly from study-backup.timer:
#   - copies each participant's exports out of their pod volume to ~/exports/<user id>/ (never deletes there, so the
#     copy outlives the volume, which goes when a participant is deleted),
#   - dumps the provisioning (participants, activity, screen recordings) and litellm databases to ~/backups/, along
#     with a tarball of ~/exports, keeping KEEP_DAYS days,
#   - prints a status: completed sessions without a result file, disk usage,
#   - reports the outcome to Conditioner's dashboard (POST 127.0.0.1:8180/monitor/report/backup or .../collect),
#     also when it fails.
# `study-backup.sh collect` only copies the exports and prints the status (fetch-study-data.sh runs that).
set -eu
umask 077
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
STUDY=agentic-coding
EXPORTS="$HOME/exports"
BACKUPS="$HOME/backups"
KEEP_DAYS=7
DB=deploy_db_1

psql() { podman exec "$DB" sh -c "psql -tA -U \"\$POSTGRES_USER\" -d provisioning -c \"$1\""; }

collect() {
  mkdir -p "$EXPORTS"
  for vol in $(podman volume ls --format '{{.Name}}' | grep "^user-$STUDY-.*-data$" || true); do
    id=${vol#user-"$STUDY"-}
    id=${id%-data}
    mkdir -p "$EXPORTS/$id"
    # The volume is the pod's /data; the harness writes only to /data/exports. A fresh volume has no exports yet.
    tmp=$(mktemp -d)
    podman volume export "$vol" | tar -x -C "$tmp"
    if [ -d "$tmp/exports" ]; then cp -p "$tmp"/exports/* "$EXPORTS/$id"/ 2>/dev/null || true; fi
    rm -rf "$tmp"
  done
}

dump() {
  mkdir -p "$BACKUPS"
  day=$(date +%F)
  for db in provisioning litellm; do
    podman exec "$DB" sh -c "pg_dump -U \"\$POSTGRES_USER\" -Fc $db" > "$BACKUPS/.$db-$day.dump"
    mv "$BACKUPS/.$db-$day.dump" "$BACKUPS/$db-$day.dump"
  done
  tar -czf "$BACKUPS/.exports-$day.tar.gz" -C "$HOME" exports
  mv "$BACKUPS/.exports-$day.tar.gz" "$BACKUPS/exports-$day.tar.gz"
  find "$BACKUPS" -maxdepth 1 -type f -mtime +$((KEEP_DAYS - 1)) -delete
}

completed=
missing=
missing_ids=
disk=

status() {
  completed=0
  missing=0
  for id in $(psql "SELECT user_id FROM users WHERE session_end IS NOT NULL AND NOT is_test;"); do
    completed=$((completed + 1))
    safe=$(printf '%s' "$id" | tr -c 'a-zA-Z0-9_.-' '_')
    if ! ls "$EXPORTS/$safe"/*_*.json >/dev/null 2>&1; then
      echo "MISSING result file for completed participant $id"
      missing=$((missing + 1))
      missing_ids="$missing_ids $id"
    fi
  done
  disk=$(df --output=pcent / | tail -1 | tr -d ' %')
  echo "completed sessions: $completed (without result file: $missing), participants with exports: $(ls "$EXPORTS" 2>/dev/null | wc -l)"
  echo "disk: ${disk}% used, exports $(du -sh "$EXPORTS" 2>/dev/null | cut -f1), backups $(du -sh "$BACKUPS" 2>/dev/null | cut -f1)"
  if [ "$disk" -ge 80 ]; then echo "WARNING: disk ${disk}% full"; fi
}

size() { if [ -d "$1" ]; then du -sb "$1" | cut -f1; else echo null; fi; }

report() {
  code=$?
  # a failed dump leaves its temporary file behind
  rm -f "$BACKUPS"/.*.dump "$BACKUPS"/.exports-*.tar.gz
  ids=$(for id in $missing_ids; do printf '"%s",' "$id"; done)
  json=$(printf '{"mode":"%s","ok":%s,"exit":%d,"finished_at":"%s","completed":%s,"missing":%s,"disk_percent":%s,"exports_bytes":%s,"backups_bytes":%s}' \
    "$mode" "$([ "$code" = 0 ] && echo true || echo false)" "$code" "$(date -Is)" "${completed:-null}" \
    "$([ -n "$completed" ] && echo "[${ids%,}]" || echo null)" "${disk:-null}" \
    "$(size "$EXPORTS")" "$(size "$BACKUPS")")
  name=backup
  if [ "$mode" = collect ]; then name=collect; fi
  curl -s -m 5 -o /dev/null -X POST -H "content-type: application/json" --data "$json" "http://127.0.0.1:8180/monitor/report/$name" || true
}

mode=${1:-all}
case "$mode" in
  collect) trap report EXIT; collect; status ;;
  all) trap report EXIT; collect; dump; status ;;
  *) echo "usage: $0 [collect|all]" >&2; exit 2 ;;
esac
