#!/usr/bin/env bash
#
# Verifies a live UFO database actually has the Phase 1-4 fixes in effect.
#
# This checks the RESULT, not that a file ran: whether templates is genuinely
# RLS-protected, whether the atomic credit functions exist, whether webhook
# replays can be deduplicated, whether the asset bucket is private. Safe to run
# against production — it only reads catalog metadata and writes nothing.
#
#   DATABASE_URL='postgresql://...' ./scripts/verify-database.sh
#
# Exits non-zero if any check fails, so it can gate a deploy.

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL is not set." >&2; exit 2; }
command -v psql >/dev/null 2>&1 || { echo "psql is not installed." >&2; exit 2; }

OUT="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO/scripts/verify-database.sql")"
echo "$OUT"

if echo "$OUT" | grep -q '^FAIL'; then
  echo
  echo "Database is NOT ready. Apply the pending migrations:"
  echo "  DATABASE_URL='...' ./scripts/apply-migrations.sh"
  exit 1
fi

echo
echo "Database verified."
