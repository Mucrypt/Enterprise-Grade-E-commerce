# Production Migration State Check — Read-Only Commands

**Purpose:** confirm what has actually been applied to the live production database before any new migration (e.g. the future `staff_memberships` table from `docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md`) is written or run. `026_unified_analytics_schema.sql` contains a foreign key to a table (`admins`) that does not exist in any migration file, so its actual applied/unapplied status in production must be confirmed, not assumed.

**Who runs this:** the founder, on the Hetzner production server, over the existing SSH session. Claude has no access to production and did not run any of this.

**Safety guarantee — every command below is a plain `SELECT` / metadata read.** None of them:
- write, update, delete, or insert any row
- create, alter, or drop any table
- run migrations
- restart any container
- print a password, API key, or `.env` value

All commands go through the running `techtools-postgres-prod` container (per `infrastructure/docker-compose.prod.yml`) using the container's own already-configured `POSTGRES_USER`/`POSTGRES_DB` environment — you do not need to type or paste any credential.

---

## 1. Confirm the app's migration tracking table exists, and what it says

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT to_regclass('"'"'public.schema_migrations'"'"') AS schema_migrations_table_exists;
"'
```

If that returns a non-null value (`schema_migrations`), the tracking table exists. Then list every migration it believes has run, in order:

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id;
"'
```

If `schema_migrations` does **not** exist, that itself is important information — it means the app's own tracked migration runner (`npm run migrate:*` / `tech-tools-api/src/database/migrate.ts`) has never been run against this database, and everything currently in the schema got there via the separate Docker-init path (see §4).

## 2. Check specifically for migration 026 and its dependency

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT to_regclass('"'"'public.admins'"'"')          AS admins_table_exists,
       to_regclass('"'"'public.user_sessions'"'"')   AS user_sessions_table_exists,
       to_regclass('"'"'public.events_core'"'"')     AS events_core_table_exists,
       to_regclass('"'"'public.event_aggregates_hourly'"'"') AS event_aggregates_hourly_exists,
       to_regclass('"'"'public.alerts'"'"')          AS alerts_table_exists;
"'
```

Interpretation:
- `admins_table_exists` should be **NULL** (no such table has ever existed in any migration file — this is expected and correct, per the audit).
- `user_sessions`, `events_core`, `event_aggregates_hourly`, `alerts` are the four tables `026_unified_analytics_schema.sql` creates. If these exist but `admins` doesn't, migration 026 was hand-patched (its `alerts.acknowledged_by REFERENCES admins(id)` line must have been edited or removed before running) or applied through a path that isn't `CREATE TABLE ... REFERENCES admins(id)` verbatim — worth a closer look, not an emergency.
- If `alerts` doesn't exist at all, migration 026 (and by the runner's transactional-batch behavior, everything after it — 027 through 039) has likely never successfully run through the tracked path.

## 3. Full table inventory and Postgres version ("current schema version")

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT version();
"'
```

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = '"'"'public'"'"'
ORDER BY table_name;
"'
```

This full table list is the most reliable "current schema version" signal — cross-reference it against the migration filenames in `tech-tools-api/src/database/migrations/` to see which migrations' tables are actually present, independent of what `schema_migrations` claims.

## 4. Check whether the alternate (untracked) init path ever ran

`infrastructure/docker-compose.prod.yml` mounts the migrations folder as Postgres's own `docker-entrypoint-initdb.d`, which only executes on a **fresh, empty** data volume and does not use `schema_migrations`. There's no safe read-only way to prove this happened after the fact beyond what §1–3 already show (a schema that exists but an empty/missing `schema_migrations` table would be the signature of this path having run instead of the tracked runner). No additional command needed — interpret §1's result together with §3's table list.

## 5. Row counts only (optional, sanity check that nothing looks empty/wrong) — still read-only

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT '"'"'users'"'"' AS table_name, count(*) FROM users
UNION ALL SELECT '"'"'orders'"'"', count(*) FROM orders
UNION ALL SELECT '"'"'products'"'"', count(*) FROM products;
"'
```

---

## What to send back

Paste the output of §1, §2, and §3 (version + table list) back. That's enough to determine:
1. Whether `schema_migrations` reflects reality.
2. Whether migration 026 (and therefore 027–039) actually ran.
3. Whether `admins` truly doesn't exist anywhere in production (expected) or was somehow created out-of-band (unexpected — would need investigation before any new migration touches this area).

**No migration will be written or run until this output is reviewed.** This applies specifically to the `staff_memberships` migration proposed in `docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md` — it stays deferred per that document's Phase 1 plan and this phase's explicit "do not create a new database migration yet" constraint.
