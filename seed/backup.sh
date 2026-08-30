#!/usr/bin/env bash
# The seed's nightly hand: a timestamped pg_dump into seed/backups/, pruned after 30.
# (The in-app export ceremony remains the human-readable soul-backup; this is the body.)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
docker compose exec -T db pg_dump -U lightseed --clean --if-exists lightseed > "backups/lightseed-${stamp}.sql"
echo "backed up: backups/lightseed-${stamp}.sql ($(du -h "backups/lightseed-${stamp}.sql" | cut -f1))"
ls -1t backups/lightseed-*.sql | tail -n +31 | xargs -I{} rm -- {} 2>/dev/null || true
