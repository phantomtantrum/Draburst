#!/usr/bin/env bash
# Spins up a throwaway PostgreSQL cluster, applies an auth shim + all
# migrations, and runs supabase/tests/rls_test.sql. Requires postgres binaries.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DIR="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
cleanup() { "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -M -s /bin/false pgtest
  chown -R pgtest "$DIR"
  RUNAS=(runuser -u pgtest --)
fi
"${RUNAS[@]}" "$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -w start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database qp"
"${PSQL[@]}" -d qp -f "$ROOT/supabase/tests/auth_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d qp -f "$f"; done
"${PSQL[@]}" -d qp -f "$ROOT/supabase/tests/rls_test.sql"
