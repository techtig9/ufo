#!/usr/bin/env bash
#
# Applies schema.sql + every migration to a throwaway local Postgres, then runs
# the RLS suite as the real `anon` / `authenticated` PostgREST roles.
#
# Why this exists: RLS bugs are invisible to a superuser session (a superuser
# bypasses RLS entirely), which is exactly how the policy-recursion bug fixed by
# migration 006 survived earlier review. These tests connect as the same roles
# PostgREST uses, so a missing policy actually fails.
#
# Usage:  ./supabase/tests/run.sh [--before]
#           (no flag)  apply every migration, including 007  -> everything should pass
#           --before   stop at 006, i.e. the pre-Phase-1 state -> TEST 1/3 should FAIL,
#                      demonstrating the templates RLS hole this migration closes
#
# Requires postgres server binaries locally; it never touches a remote project.

set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
BASE="${BASE:-/var/tmp/ufopg}"
PORT="${PORT:-55432}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB=ufo_test

STOP_AT_006=0
[[ "${1:-}" == "--before" ]] && STOP_AT_006=1

# pg_isready, not `pg_ctl status`: the data dir is owned by the unprivileged
# postgres user, so a status check from another account fails even when the
# server is up — and re-initdb'ing then collides with the live server's port.
if ! "$PGBIN/pg_isready" -h "$BASE" -p "$PORT" -q 2>/dev/null; then
  echo "==> starting a throwaway postgres in $BASE"
  rm -rf "$BASE"; mkdir -p "$BASE"
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  chown -R pgtest:pgtest "$BASE"
  su pgtest -c "$PGBIN/initdb -D $BASE/data -U postgres --auth=trust" >"$BASE/initdb.log" 2>&1
  su pgtest -c "$PGBIN/pg_ctl -D $BASE/data -o '-p $PORT -k $BASE' -l $BASE/pg.log start" >/dev/null
  sleep 2
fi

PSQL="psql -h $BASE -p $PORT -U postgres"

echo "==> rebuilding $DB"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"

APPLY="$PSQL -d $DB -v ON_ERROR_STOP=1 -q"
$APPLY -f "$REPO/supabase/tests/00_supabase_harness.sql"
$APPLY -f "$REPO/supabase/schema.sql"

for migration in "$REPO"/supabase/migrations/*.sql; do
  if [[ $STOP_AT_006 -eq 1 && "$(basename "$migration")" == 007_* ]]; then
    echo "    skipping $(basename "$migration") (--before)"
    continue
  fi
  $APPLY -f "$migration"
  echo "    applied $(basename "$migration")"
done

echo
echo "==> running Phase 1 RLS suite as anon / authenticated"
$PSQL -d $DB -f "$REPO/supabase/tests/rls_tests.sql" 2>&1 |
  grep -vE '^SET$|^RESET$|^-+$|^\(1 row\)$|Pager usage'

# Phase 2 tests need their own clean database: the Phase 1 suite leaves rows
# behind that would collide with its fixtures.
if [[ $STOP_AT_006 -eq 0 ]]; then
  echo
  echo "==> running Phase 2 suite (atomic credits, webhook idempotency)"
  DB2=${DB}_p2
  $PSQL -q -c "drop database if exists $DB2;" -c "create database $DB2;"
  APPLY2="$PSQL -d $DB2 -v ON_ERROR_STOP=1 -q"
  $APPLY2 -f "$REPO/supabase/tests/00_supabase_harness.sql"
  $APPLY2 -f "$REPO/supabase/schema.sql"
  for migration in "$REPO"/supabase/migrations/*.sql; do $APPLY2 -f "$migration"; done
  $PSQL -d $DB2 -f "$REPO/supabase/tests/phase2_tests.sql" 2>&1 |
    grep -vE '^SET$|^RESET$|^-+$|^\(1 row\)$|Pager usage'

  echo
  echo "==> running Phase 4 suite (workspace roles, share permissions)"
  DB4=${DB}_p4
  $PSQL -q -c "drop database if exists $DB4;" -c "create database $DB4;"
  APPLY4="$PSQL -d $DB4 -v ON_ERROR_STOP=1 -q"
  $APPLY4 -f "$REPO/supabase/tests/00_supabase_harness.sql"
  $APPLY4 -f "$REPO/supabase/schema.sql"
  for migration in "$REPO"/supabase/migrations/*.sql; do $APPLY4 -f "$migration"; done
  $PSQL -d $DB4 -f "$REPO/supabase/tests/phase4_tests.sql" 2>&1 |
    grep -vE '^SET$|^RESET$|^-+$|^\(1 row\)$|Pager usage'
fi
