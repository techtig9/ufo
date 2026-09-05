#!/usr/bin/env bash
#
# Proves the credit double-spend race is real, and that reserve_credits fixes it.
#
# Both halves run N genuinely concurrent psql clients against the same user:
#   OLD: read balance, sleep, write (balance - cost)  <- what the app did
#   NEW: select reserve_credits(...)                  <- what it does now
#
# With cost*N exactly equal to the starting balance, a correct implementation
# ends at 0 with N successes. The old one ends far above 0 because the writes
# clobber each other.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
BASE="${BASE:-/var/tmp/ufopg}"
PORT="${PORT:-55432}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB=ufo_concurrency
N="${N:-10}"
COST="${COST:-100}"
START=$((N * COST))
USER_ID='11111111-1111-1111-1111-111111111111'

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
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"
A="$PSQL -d $DB -v ON_ERROR_STOP=1 -q"
$A -f "$REPO/supabase/tests/00_supabase_harness.sql"
$A -f "$REPO/supabase/schema.sql"
for m in "$REPO"/supabase/migrations/*.sql; do $A -f "$m"; done

seed() {
  $A -c "delete from credit_ledger;" \
     -c "delete from subscriptions;" -c "delete from users;" -c "delete from auth.users;"
  $A -c "insert into auth.users (id,email) values ('$USER_ID','race@example.com');"
  $A -c "insert into users (id,email) values ('$USER_ID','race@example.com');"
  $A -c "insert into subscriptions (user_id, plan, status, credits_remaining)
         values ('$USER_ID','pro','active',$START);"
}

balance() { $PSQL -d $DB -tAc "select credits_remaining from subscriptions where user_id='$USER_ID';"; }

echo
echo "=============================================================="
echo " $N concurrent charges of $COST credits, starting balance $START"
echo " A correct implementation must end at exactly 0."
echo "=============================================================="

# ---------- OLD: read-modify-write, as the app did before ----------
seed
for i in $(seq 1 $N); do
  $PSQL -d $DB -q -c "
    begin;
    create temp table if not exists t(v int);
    delete from t;
    insert into t select credits_remaining from subscriptions where user_id='$USER_ID';
    select pg_sleep(0.15);
    update subscriptions set credits_remaining = (select v from t) - $COST
      where user_id='$USER_ID';
    commit;" >/dev/null 2>&1 &
done
wait
OLD=$(balance)

# ---------- NEW: atomic reserve_credits ----------
seed
OKFILE=$(mktemp)
for i in $(seq 1 $N); do
  ( $PSQL -d $DB -tAc "select out_success from reserve_credits('$USER_ID', $COST, 'generate_full_project', 'req-$i');" >> "$OKFILE" 2>/dev/null ) &
done
wait
NEW=$(balance)
SUCCESSES=$(grep -c '^t$' "$OKFILE" || true)
LEDGER=$($PSQL -d $DB -tAc "select count(*) from credit_ledger where amount < 0;")
rm -f "$OKFILE"

echo
printf "  OLD read-modify-write : final balance %-6s (expected 0)  -> %s\n" "$OLD" \
  "$([ "$OLD" = "0" ] && echo 'no race observed' || echo "RACE: $OLD credits never charged")"
printf "  NEW reserve_credits   : final balance %-6s (expected 0)  -> %s\n" "$NEW" \
  "$([ "$NEW" = "0" ] && echo 'correct' || echo 'INCORRECT')"
printf "  NEW successful charges: %s (expected %s)\n" "$SUCCESSES" "$N"
printf "  NEW ledger rows       : %s (expected %s)\n" "$LEDGER" "$N"

echo
echo "=== over-spend guard: one more charge with a 0 balance ==="
$PSQL -d $DB -tAc "select out_success, out_credits_remaining from reserve_credits('$USER_ID', $COST, 'generate_full_project', 'req-over');"
echo "  ^ expect: f|0  (refused, balance not negative)"

echo
echo "=== refund is idempotent ==="
$PSQL -d $DB -tAc "select out_success, out_credits_remaining from refund_credits('$USER_ID', $COST, 'generate_full_project', 'req-1', 'refund_generation_failed');"
$PSQL -d $DB -tAc "select out_success, out_credits_remaining from refund_credits('$USER_ID', $COST, 'generate_full_project', 'req-1', 'refund_generation_failed');"
echo "  ^ expect: t|$COST then t|$COST — the second refund must NOT add again"

[ "$NEW" = "0" ] && [ "$SUCCESSES" = "$N" ] || { echo; echo "CONCURRENCY TEST FAILED"; exit 1; }
echo
echo "CONCURRENCY TEST PASSED"
