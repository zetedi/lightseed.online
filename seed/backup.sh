#!/usr/bin/env bash
# The seed's backup hand: a completed, private pg_dump into seed/backups/.
# (The in-app export ceremony remains the human-readable soul-backup; this is the body.)
set -euo pipefail
cd "$(dirname "$0")"
umask 077
mkdir -p backups
temporary="$(mktemp backups/.incomplete-XXXXXX)"
trap 'rm -f -- "$temporary"' EXIT
# A failed dump must not appear to be a valid backup, or prune the last good copy.
docker compose exec -T db pg_dump -U lightseed --clean --if-exists lightseed > "$temporary"
backup="backups/lightseed-$(date -u +%Y%m%dT%H%M%SZ)-${temporary##*-}.sql"
mv -- "$temporary" "$backup"
echo "backed up: $backup"
# Retention is deliberately separate: inspect/restore a backup before removing older ones.
