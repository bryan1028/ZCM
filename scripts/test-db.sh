#!/usr/bin/env bash
# Builds a throw-away database from supabase/migrations + seed, then runs the behaviour spec in supabase/tests.
# Needs a Postgres you can create databases on, via the usual PG* env vars, e.g.
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres scripts/test-db.sh
# Exit code is non-zero if any migration or assertion fails.
set -uo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-zcm_test}"

run() {  # run <db> <file>: show output (minus NOTICEs), fail loudly on error
  local out
  if ! out=$(psql -v ON_ERROR_STOP=1 -q -d "$1" -f "$2" 2>&1); then
    echo "$out" | grep -v "NOTICE:" ; echo "✗ FAILED: $2"; exit 1
  fi
  echo "$out" | grep -v "NOTICE:" || true
}

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}" || exit 1
echo "• stubs";  run "$DB" supabase/tests/00_stubs.sql
for f in supabase/migrations/*.sql supabase/seed.sql; do echo "• applying $f"; run "$DB" "$f"; done
for f in supabase/tests/[1-9]*_*.sql; do echo "• running $f"; run "$DB" "$f"; done
echo "✓ all database tests passed"
