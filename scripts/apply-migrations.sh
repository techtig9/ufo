#!/usr/bin/env bash
#
# Applies UFO's pending database migrations to a target Postgres/Supabase.
#
# WHY THIS EXISTS
# ---------------
# Migrations 006a through 014 carry fixes and features that are not in effect
# until they run:
#   006a — backfill for a database whose 001-005 were applied by hand and left
#         pieces out (comments.resolved, shares.published_at, notifications).
#         A no-op where 001-005 really ran; without it, 011 fails outright.
#   007 — public.templates has NO row level security. Anyone holding the public
#         anon key (which ships in the browser bundle) can INSERT/UPDATE/DELETE
#         template rows, and /api/templates/[id]/use copies those rows into
#         user projects.
#   008 — credit deduction is not atomic. Two concurrent generations charge
#         once for two. Also adds the AI/observability and email-delivery logs.
#   009 — saved prompts.
#   010 — workspaces, roles and invitations; share expiry and passwords. Until
#         this runs, share passwords are accepted by the UI but not enforced.
#   011 — comment mentions and assignment. Also revokes the client UPDATE grant
#         that let a workspace viewer rewrite anyone's comment text.
#   012 — project assets. Creates the PRIVATE project-assets bucket and its
#         storage.objects policies; without them files are unreachable.
#   013 — the publish log and prototype view analytics.
#   014 — closes reserve_credits/refund_credits and three other server-only
#         helpers to the public API. Until this runs, any signed-in user can
#         call /rest/v1/rpc/refund_credits and top up their own balance.
#
# USAGE
# -----
#   DATABASE_URL='postgresql://...' ./scripts/apply-migrations.sh          # pending only (006a+)
#   DATABASE_URL='postgresql://...' ./scripts/apply-migrations.sh --all    # fresh DB: schema + 001-014
#   DATABASE_URL='postgresql://...' ./scripts/apply-migrations.sh --dry-run
#
# Get DATABASE_URL from Supabase: Project Settings -> Database -> Connection
# string -> URI. Use the SESSION pooler or a direct connection; the transaction
# pooler does not support all DDL.
#
# Migration 012 skips its bucket setup where there is no `storage` schema, so
# it also applies cleanly to a plain-Postgres database.
#
# Every migration from 006a on is written to be re-runnable (IF NOT EXISTS /
# DO blocks / CREATE OR REPLACE), so a repeat run is a no-op rather than an
# error. Take a backup first anyway — Supabase: Database -> Backups.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="pending"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --all) MODE="all" ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  echo "Supabase: Project Settings -> Database -> Connection string -> URI" >&2
  exit 2
fi

command -v psql >/dev/null 2>&1 || { echo "psql is not installed." >&2; exit 2; }

if [[ "$MODE" == "all" ]]; then
  FILES=("$REPO/supabase/schema.sql")
  while IFS= read -r f; do FILES+=("$f"); done < <(ls "$REPO"/supabase/migrations/*.sql | sort)
else
  FILES=()
  # "006a" rather than "007": the backfill sorts between 006 and 007, and 011
  # depends on it. ASCII puts '_' (0x5F) below 'a' (0x61), so 006_fix_rls stays
  # out of the pending set while 006a_backfill comes in.
  while IFS= read -r f; do FILES+=("$f"); done < <(ls "$REPO"/supabase/migrations/*.sql | sort | awk -F/ '$NF >= "006a"')
fi

echo "Target : $(echo "$DATABASE_URL" | sed -E 's#(//[^:]+):[^@]+@#\1:****@#')"
echo "Mode   : $MODE"
echo "Files  :"
for f in "${FILES[@]}"; do echo "         $(basename "$f")"; done
echo

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run — nothing applied."
  exit 0
fi

for f in "${FILES[@]}"; do
  echo "==> applying $(basename "$f")"
  # ON_ERROR_STOP so a failure halts rather than leaving a half-applied chain.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo
echo "All migrations applied. Now verify:"
echo "  DATABASE_URL='...' ./scripts/verify-database.sh"
