#!/usr/bin/env bash
# Cria um banco temporário, aplica as migrações e roda os testes.
# Uso: PGHOST=... PGPORT=... PGUSER=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="mercado_test_$$"
createdb "$DB"
trap 'dropdb "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/shim.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/orders.test.sql
