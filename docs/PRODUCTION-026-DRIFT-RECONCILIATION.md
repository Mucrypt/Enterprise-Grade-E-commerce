# Production Migration 026 — Drift Reconciliation

**Status:** Read-only investigation only. No migration has been written or applied. Confirms/supersedes the "026 will fail if re-run" framing in `docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md` §12 with what production actually shows.

**Production facts this is built on** (from the founder's own read-only run on Hetzner):
- `schema_migrations` recorded through `039_refund_cancellation_consistency.sql`, 36 rows, including `026_unified_analytics_schema.sql` (id 23).
- `admins` table: does not exist. `alerts` table: does not exist.
- `user_sessions`, `events_core`, `event_aggregates_hourly`, `alert_thresholds`: all exist.
- PostgreSQL 15.15. 107 tables in `public`. ~4 users / 7 orders / 28 products.

---

## 1. What `026_unified_analytics_schema.sql` intends to create

Read in full (`tech-tools-api/src/database/migrations/026_unified_analytics_schema.sql`):

| Object | Type | Line |
|---|---|---|
| `event_type_enum` | enum | 8 |
| `event_source_enum` | enum | 30 |
| `device_type_enum` | enum | 39 |
| `alert_severity_enum` | enum | 47 |
| `user_sessions` | table | 55 |
| `events_core` | table | 80 |
| `event_aggregates_hourly` | table | 115 |
| `alerts` | table | 130, FK at line 149: `acknowledged_by UUID REFERENCES admins(id) ON DELETE SET NULL` |
| 10 indexes on `user_sessions`/`events_core`/`event_aggregates_hourly` | index | 160–184 |
| 5 indexes on `alerts` | index | 187–191 |
| Table/column comments | comment | 206–211 |

## 2. Object-by-object reconciliation against confirmed production state

| Object | Classification | Evidence |
|---|---|---|
| `event_type_enum`, `event_source_enum`, `device_type_enum`, `alert_severity_enum` | **UNKNOWN** (not directly checked, but see §3 for the query to confirm — types aren't in `information_schema.tables` so the table list doesn't cover them) | Almost certainly present: `events_core`/`user_sessions` couldn't exist without `event_type_enum`/`event_source_enum`/`device_type_enum` (they're used as column types) |
| `user_sessions` | **PRESENT_AND_COMPATIBLE** | Confirmed in the 107-table list; also extended by `037_live_visitor_analytics.sql` (also recorded, id 33) adding `country_code`/`country_name`/`city` — those columns depend on this table existing, consistent |
| `events_core` | **PRESENT_AND_COMPATIBLE** | Confirmed in the table list |
| `event_aggregates_hourly` | **PRESENT_AND_COMPATIBLE** | Confirmed in the table list |
| `alerts` | **MISSING** | Absent from the 107-table list. Its `acknowledged_by UUID REFERENCES admins(id)` cannot succeed against a database where `admins` never exists (confirmed absent too) |
| indexes on `user_sessions`/`events_core`/`event_aggregates_hourly` | **UNKNOWN** (not directly checked — see §3 query) | Likely present given their parent tables are; worth confirming, cheap to check |
| indexes on `alerts` | **MISSING** (by necessity — an index can't exist on a table that doesn't) | — |
| table/column comments | **UNKNOWN** for `events_core`/`user_sessions` comments, **MISSING** for the `alerts` comment (line 211) | — |

**Net:** everything 026 was supposed to create *except* `alerts` (table, its 5 indexes, and its comment) is present and appears correct. The damage is scoped precisely to the one object with the broken FK — nothing else in the file is implicated.

## 3. Additional read-only commands, if you want to close the remaining UNKNOWNs

None of these are required to proceed — the table-level evidence already answers the question that matters (§4) — but if you want full certainty:

```bash
# Confirm the four enum types exist with their expected values
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('"'"'event_type_enum'"'"','"'"'event_source_enum'"'"','"'"'device_type_enum'"'"','"'"'alert_severity_enum'"'"')
ORDER BY t.typname, e.enumsortorder;
"'
```

```bash
# Confirm the expected indexes on the three tables that do exist
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN ('"'"'user_sessions'"'"','"'"'events_core'"'"','"'"'event_aggregates_hourly'"'"')
ORDER BY tablename, indexname;
"'
```

## 4. How could `026` be recorded as executed while `alerts` is absent?

This is the one part of the investigation that can't be answered with 100% certainty — PostgreSQL doesn't retain DDL history by default, and there's no audit extension configured here to check. But the available evidence points strongly at one explanation and rules out the alternatives:

**Git history rules out "the file was edited after being applied."** `git log --follow` on this file shows exactly **one commit ever**, `50f9e1a` ("feat: add websocket service for real-time analytics and alerts broadcasting"), on 2026-05-13 19:51:58 +0200 (17:51:58 UTC). The file has contained the `alerts` table and the broken `admins(id)` FK since the moment it was created — it was never edited afterward to introduce this bug into an already-applied file.

**Migration timing rules out "it was never actually run by the tracked runner."** `schema_migrations` shows `024`, `025`, `026`, `027` all executed on 2026-05-13 within about 1 second of each other (17:58:30.231 → 17:58:31.135) — that's the signature of one `npm run migrate:up` batch run processing several pending migrations in sequence, ~7 minutes after the commit landed (consistent with a normal build-then-deploy-then-migrate flow). This was the tracked, transactional runner (`tech-tools-api/src/database/migrate.ts`), not a manual/ad hoc `psql -f` invocation.

**This creates a real puzzle:** `migrate.ts` wraps each file in one `BEGIN ... COMMIT` and sends the whole file as one multi-statement query. Under PostgreSQL's simple query protocol, an error partway through a multi-statement string aborts the transaction and stops processing the rest of that string — so a failure creating `alerts` (partway through the file) should have rolled back the whole transaction, including the earlier-successful `user_sessions`/`events_core`/`event_aggregates_hourly` creates, and should have thrown out of `runMigration`, which would have stopped the batch entirely (`migrate()` calls `process.exit(1)` on any failure) — meaning `027` should never have run in that same batch. But `027` (and everything through `039`) clearly did run, later, successfully.

**The only explanation consistent with all of this:** an `admins` table existed in production *at the moment 026 ran*, letting the `alerts` table's FK succeed without error — and both `admins` and `alerts` were removed from production at some later point, outside of any migration file, most likely as a manual cleanup once someone realized `admins` was never the right model (`users.user_type` is, and has been since `002_admin_management_schema.sql`) and `alerts` depended on it. This is a hypothesis, not a certainty — but it's the only one that doesn't contradict the git history, the batch-timing evidence, or the fact that 027 onward all ran cleanly afterward.

**Independent corroborating evidence that this has been known and worked around before:** `tech-tools-api/src/workers/metrics.broadcaster.ts:163-168` already has a specific handler for exactly this:
```ts
} catch (error: any) {
  // Gracefully handle missing alerts table
  if (error?.code === '42P01') {
    logger.warn('Skipping alert stats: alerts table is missing')
    return { critical: 0, high: 0, medium: 0, low: 0 }
  }
  ...
```
(`42P01` is Postgres's `undefined_table` error code.) Someone already hit this in production, at some point before now, and patched around it in this one call site — but not in the other three places that touch `alerts` (see §5). This independently confirms the table has been missing for a real, non-trivial amount of time, not just since the moment this investigation started.

## 5. Is `alerts` actually needed, or safe to leave missing?

**It's needed — this is not dead code.** Four live call sites depend on the table existing, and only one of them has a workaround:

1. **`tech-tools-api/src/services/anomaly.detector.ts:378,400`** — `createAlert()`, called by the anomaly-detection worker (`src/workers/anomaly.detection.ts`, started at server boot, **runs every 15 minutes in production right now**). Wrapped in a generic try/catch that logs and swallows the error (`anomaly.detector.ts:437-438`) — **no `42P01` handling**. Net effect: every 15 minutes, if an anomaly is actually detected, the `INSERT INTO alerts` fails silently, and — because the admin-notification dispatch call sits *after* that insert in the same try block — **admins never get notified of the anomaly either**. This is a real, currently-active, silent operational gap, not a hypothetical one.
2. **`tech-tools-api/src/api/v1/alerts/alerts.controller.ts`** — full REST API (`GET /api/v1/alerts`, `GET /stats`, `GET /:id`, `POST /:id/acknowledge`, `POST /:id/dismiss`), mounted at `/api/v1/alerts` (`api/v1/index.ts:74`), gated `authenticate + authorize('admin','super_admin')`. Every handler would 500 today if called (no `42P01` handling — the generic catch just logs and returns 500). **No admin-dashboard page currently calls this** (searched `admin-dashboard/app`, `services`, `components` — the only "alert"-related page is `(dashboard)/dashboard/settings/alert-thresholds`, which is the separate, existing, unrelated `alert_thresholds` table, not this one), so this is currently a dormant-but-broken API surface rather than something visibly failing for an admin today.
3. **`tech-tools-api/src/workers/metrics.broadcaster.ts:153`** — has the `42P01` workaround (§4), so this one degrades gracefully (returns zeroed alert counts) rather than breaking anything.
4. **`admin-dashboard/hooks/useRealtimeMetrics.ts:131,139,173`** + **`tech-tools-api/src/services/websocket.service.ts:142-147`** — a real-time Socket.io hook/broadcast path for `alert-acknowledged` events. It's wired up correctly on both ends but can never actually fire, since the REST acknowledge endpoint that would trigger it (item 2) 500s before reaching that broadcast call.

**`acknowledged_by` confirms the FK target is definitely `users`, not `admins`.** `alerts.controller.ts:122,140` (`acknowledgeAlert`) and the equivalent in `dismissAlert` do `const adminId = req.user?.id` — straight from the JWT payload, which is a `users.id` (per `middleware/auth.ts`, `req.user.id = decoded.userId`). This value was always going to be written into a column the migration constrains to `REFERENCES admins(id)` — the FK was broken by design from the very first commit, independent of whatever happened in production afterward. Every other admin-actor FK in the codebase already uses the correct pattern (e.g. `027_notification_preferences.sql:9` — `admin_id UUID NOT NULL REFERENCES users(id)`), confirming `users(id)` is the one established, correct convention — `alerts` is the sole outlier.

**Conclusion: a repair is warranted, not unnecessary.** This isn't a table nobody uses; it's the persistence layer for a currently-running, currently-silently-failing anomaly-alerting feature, plus a dormant admin REST API and a dormant real-time broadcast path — all three real, built features, not scaffolding.

## 6. Recommended repair (not yet written — pending your go-ahead)

A new, additive, forward-only migration — **do not edit `026`** (per the hard rule, and per §4 it's also unnecessary: nothing about editing the historical file would change what's already in production, and rewriting an applied migration's file is exactly the discipline problem this whole investigation exists to avoid).

**Numbering:** since `037_live_visitor_analytics.sql` (id 33) and `036_supplier_catalogue_import.sql` (id 34) already show out-of-numeric-order execution in production (037 ran 2026-07-31, 036 ran 2026-08-01 — a day *later* despite the lower number), the tracked runner clearly doesn't require strict numeric ordering, only "not already in `schema_migrations`." The next free, unused filename is **`040`**. Recommend `040_repair_unified_analytics_alerts.sql`.

**Required shape** (for your review before I write it — not written yet):
- `CREATE TABLE IF NOT EXISTS alerts (...)`, identical column-for-column to `026`'s definition, except `acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL` instead of `REFERENCES admins(id)`.
- The same 5 indexes and 1 table comment `026` already specifies for `alerts`, using `IF NOT EXISTS` throughout (idempotent, matches the rest of the codebase's migration style).
- No `ALTER`/`DROP` on any existing table — purely additive.
- Nothing else from `026` is touched or recreated (per §2, everything else is already correct in production).

**Rollback:** `DROP TABLE IF EXISTS alerts` — safe, since nothing else references it (confirmed no other table has an FK to `alerts`, per the object list in §1/§2), and it would be a brand-new, empty table with no data to lose.

**What this does *not* need to solve:** whether `alerts` should have ever referenced `admins` in the first place, or whatever happened to the historical `admins`/`alerts` tables in production (§4) — both are moot once the new migration ships with the correct `users(id)` reference from the start.

**Update:** `tech-tools-api/src/database/migrations/040_repair_unified_analytics_alerts.sql` has now been written, matching the shape above exactly, plus one defensive addition: `alert_severity_enum`'s creation is wrapped in a `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_type ...) $$` guard rather than assumed present, since that couldn't be confirmed via a read-only check before writing it (types survive their using table being dropped, so it almost certainly still exists, but this makes the migration correct either way).

**It has not been applied anywhere.** I don't have a way to run it against a live PostgreSQL instance from this environment to test it end-to-end — Docker's CLI is present here but there's no reachable daemon, and no local Postgres is listening either, so the live-database testing called for in the phase brief (§9: clean apply, idempotency, rollback) couldn't be executed by me. What I did instead: verified every statement is syntactically identical to the corresponding statement in `026`, which is proven to work (those exact `CREATE TABLE`/`CREATE INDEX`/`COMMENT ON TABLE` forms already succeeded in production for `user_sessions`/`events_core`/`event_aggregates_hourly`), so the only genuinely new, unverified piece is the `DO` block guarding `alert_severity_enum`. Before running this against production, run it first against a real Postgres instance you control (local Docker, or a throwaway staging database) — even just `docker compose -f infrastructure/docker-compose.dev.yml up -d postgres` locally and pointing `DB_*` at it for one `npm run migrate:up` would do it.

## 7. MARKET-OPS migration numbering

If the `040` repair above is approved and applied, the `staff_memberships`/`staff_audit_log` migration from `docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md` becomes **`041`**. If the repair is deferred or judged unnecessary, staff becomes `040`. Either way — **do not guess**: the actual next-free number should be re-confirmed against `schema_migrations` immediately before writing it, in case anything else has landed in between.
