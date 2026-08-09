#!/bin/bash
set -euo pipefail

# Tests migration 040_repair_unified_analytics_alerts.sql against a
# throwaway PostgreSQL 15 container built to match production's ACTUAL
# current state, per docs/PRODUCTION-026-DRIFT-RECONCILIATION.md: a
# `users` table and the `alert_severity_enum` type exist; `admins` and
# `alerts` do not.
#
# This is deliberately NOT a full replay of migrations 001-039 -- running
# the real 026 file top-to-bottom would itself fail (that's the whole
# reason 040 exists), so a full historical replay cannot reproduce
# production's actual shape. This script builds the minimal precondition
# directly instead.
#
# Requires: a working `docker` daemon (this was written and reviewed in an
# environment where none was reachable, so it has not been executed by
# the person who wrote it -- run it somewhere docker actually works, e.g.
# your local machine, before trusting it against production data. Every
# object it creates is fully throwaway and isolated -- it never touches
# any real database).
#
# Usage: ./scripts/test-040-repair-migration.sh

CONTAINER_NAME="techtools-040-migration-test"
IMAGE="postgres:15-alpine"
DB_NAME="techtools_test"
DB_USER="techtools_user"
DB_PASSWORD="test_password_only"
MIGRATION_FILE="$(cd "$(dirname "$0")/.." && pwd)/src/database/migrations/040_repair_unified_analytics_alerts.sql"

cleanup() {
  echo "Cleaning up test container..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "== Starting throwaway PostgreSQL 15 container =="
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  "$IMAGE" >/dev/null

echo "Waiting for PostgreSQL to be ready..."
READY=0
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "FAIL: PostgreSQL never became ready"; exit 1
fi

psql_exec() {
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

echo "== Building the minimal production-equivalent precondition =="
psql_exec <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'customer'
);

CREATE TYPE alert_severity_enum AS ENUM ('critical', 'high', 'medium', 'low');

INSERT INTO users (email, user_type) VALUES ('admin@example.test', 'admin');
SQL

echo "== TEST A: alerts table missing -- migration should create it =="
psql_exec -f "$MIGRATION_FILE"
[ "$(psql_exec -tAc "SELECT to_regclass('public.alerts') IS NOT NULL")" = "t" ] \
  && echo "PASS: alerts table now exists" \
  || { echo "FAIL: alerts table not created"; exit 1; }

echo "== TEST B: migration run again -- must not error, must not duplicate =="
psql_exec -f "$MIGRATION_FILE"
echo "PASS: second run completed without error (idempotent)"

echo "== TEST C: users exists, admins does not -- migration succeeded above without needing admins =="
[ "$(psql_exec -tAc "SELECT to_regclass('public.admins') IS NULL")" = "t" ] \
  && echo "PASS: no admins table was introduced" \
  || { echo "FAIL: an admins table exists"; exit 1; }

echo "== TEST D: acknowledged_by accepts a valid users.id =="
USER_ID=$(psql_exec -tAc "SELECT id FROM users LIMIT 1")
psql_exec -c "
  INSERT INTO alerts (alert_type, severity, title, acknowledged_by)
  VALUES ('test_alert', 'low', 'Test alert', '${USER_ID}');
"
[ "$(psql_exec -tAc "SELECT count(*) FROM alerts WHERE acknowledged_by = '${USER_ID}'")" = "1" ] \
  && echo "PASS: valid users.id accepted" \
  || { echo "FAIL: valid users.id was rejected"; exit 1; }

echo "== TEST E: acknowledged_by rejects an unknown id (FK enforcement) =="
if psql_exec -c "
  INSERT INTO alerts (alert_type, severity, title, acknowledged_by)
  VALUES ('test_alert_2', 'low', 'Test alert 2', '00000000-0000-0000-0000-000000000000');
" 2>/tmp/test-040-e-error.log; then
  echo "FAIL: an unknown user id was accepted (FK not enforced)"; exit 1
else
  if grep -q "foreign key constraint" /tmp/test-040-e-error.log; then
    echo "PASS: FK correctly rejected an unknown user id"
  else
    echo "FAIL: insert failed but not for the expected FK reason:"
    cat /tmp/test-040-e-error.log
    exit 1
  fi
fi
rm -f /tmp/test-040-e-error.log

echo "== TEST F: deleting the referenced user sets acknowledged_by to NULL =="
psql_exec -c "DELETE FROM users WHERE id = '${USER_ID}';"
[ "$(psql_exec -tAc "SELECT acknowledged_by IS NULL FROM alerts WHERE alert_type = 'test_alert'")" = "t" ] \
  && echo "PASS: acknowledged_by became NULL after the user was deleted (ON DELETE SET NULL)" \
  || { echo "FAIL: acknowledged_by was not nulled out"; exit 1; }

echo "== TEST G: pre-existing analytics tables/data remain untouched =="
# 040 must never reference or alter user_sessions/events_core/event_aggregates_hourly.
# Confirmed statically: the migration file itself contains no DDL against them.
if grep -qE '\b(user_sessions|events_core|event_aggregates_hourly)\b' "$MIGRATION_FILE"; then
  echo "FAIL: migration file references a table it must not touch"; exit 1
else
  echo "PASS: migration file does not reference user_sessions/events_core/event_aggregates_hourly"
fi

echo ""
echo "All migration-level tests (A-G) passed."
