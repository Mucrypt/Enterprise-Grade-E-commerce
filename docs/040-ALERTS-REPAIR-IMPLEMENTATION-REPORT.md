# 040 Alerts Repair — Implementation Report

**Status: nothing has been applied anywhere.** Everything in this document exists only as files in this repository, uncommitted/unpushed unless you've asked otherwise separately. No production database was touched, no server was restarted, no `.env` was modified, no other migration was written.

---

## 0. Reconfirm the migration number before doing anything else

Production's `schema_migrations` was last confirmed through `039` earlier in this session. Before applying `040`, re-run this (same read-only pattern as before — no writes, no credential typed):

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 5;
"'
```

If the last row is still `039_refund_cancellation_consistency.sql`, `040_repair_unified_analytics_alerts.sql` is confirmed as the correct, still-unused filename and everything below stands as-is. If something new has landed, stop and tell me what it is before applying anything — the filename (not the content) is what the tracked runner keys off, so a collision would need to be resolved first.

---

## 1. Final migration filename

`tech-tools-api/src/database/migrations/040_repair_unified_analytics_alerts.sql` — written in the prior phase of this session, re-verified in this phase against every real caller (§3 below), unchanged.

## 2. Migration SQL summary

- Guards `alert_severity_enum`'s creation behind a `pg_type` existence check (rather than assuming it survived, since it couldn't be confirmed via a read-only query before writing the file).
- `CREATE TABLE IF NOT EXISTS alerts (...)` — identical column set to `026`'s original definition, with exactly one change: `acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL` instead of `REFERENCES admins(id)`.
- The same 5 indexes and 1 table comment `026` already specified for `alerts`, all `IF NOT EXISTS`.
- Does not touch `026` or any other already-applied migration file. Does not create `user_sessions`, `events_core`, `event_aggregates_hourly`, or `admins`. Does not modify any existing row anywhere.

## 3. Files changed (this phase)

New:
- `tech-tools-api/scripts/test-040-repair-migration.sh` — the migration-level test script (§6 below).
- `tech-tools-api/src/services/anomaly.detector.test.ts`
- `tech-tools-api/src/api/v1/alerts/alerts.controller.test.ts`
- `tech-tools-api/src/workers/metrics.broadcaster.test.ts`

Modified:
- `tech-tools-api/src/api/v1/alerts/alerts.controller.ts` — two lines added (see finding below).
- `tech-tools-api/src/workers/metrics.broadcaster.ts` — `getActiveAlertStats` changed from module-private to `export`ed, so it's directly unit-testable. No behavior change.
- `tech-tools-api/tsconfig.json` — added an explicit `"types": ["node", "jest"]`. The new test files surfaced editor-only "Cannot find name 'jest'" errors (ambient Jest globals weren't reliably resolving for the TS language server, despite `@types/jest` being installed and `tsc`/`jest` both working fine from the command line either way). Making the ambient-types inclusion explicit fixes it for the editor without narrowing anything real — every other `@types/*` package in this project is consumed via explicit `import`, which the `types` compiler option doesn't affect. Re-verified `npm run type-check` clean and the full suite (14/14, 49/49) passing after this change.

`040_repair_unified_analytics_alerts.sql` itself is unchanged from the prior phase — re-verification (§4 below) confirmed it already matches every real caller, so no edit was needed.

### A real gap found during source-compatibility verification (§4), and fixed

Per your instruction ("current application source is authoritative," not migration 026 alone), I checked every caller listed, including `websocket.service.ts` and `useRealtimeMetrics.ts`. Both `alerts.controller.ts`'s `acknowledgeAlert`/`dismissAlert` and `anomaly.detector.ts`'s `createAlert` had **never actually called** `webSocketService.broadcastAlert*`, even though:
- `websocket.service.ts` fully implements `broadcastAlert`, `broadcastAlertAcknowledged`, `broadcastAlertDismissed`.
- `admin-dashboard/hooks/useRealtimeMetrics.ts` already listens for the `alert-acknowledged` event these would emit.
- `anomaly.detector.ts` even already `import`s `webSocketService` — and never once calls it.

So "realtime acknowledge event can be triggered" (your test requirement) was **false** before this phase, independent of the missing table — fixing the table alone would not have made it true. I wired up the two calls your test list explicitly asks for:
- `alerts.controller.ts`: `acknowledgeAlert` now calls `webSocketService.broadcastAlertAcknowledged(row.id, adminId)` after a successful update; `dismissAlert` now calls `webSocketService.broadcastAlertDismissed(row.id)`.

**Left alone, and flagged rather than fixed:** `anomaly.detector.ts`'s `createAlert` still never calls `webSocketService.broadcastAlert(...)` for a brand-new alert — the unused import stays unused. This wasn't in your explicit test list (only the acknowledge path was), and wiring it up would mean deciding what payload shape to broadcast, which is a small design decision, not a pure verification fix — flagging it here rather than expanding scope unprompted.

## 4. Schema compatibility findings

Checked every caller you listed against the migration's actual column list:

| Caller | Columns/behavior needed | Match? |
|---|---|---|
| `anomaly.detector.ts` `createAlert` | `alert_type, severity, title, message, current_value, threshold_value, baseline_value, resource_type, resource_id, is_active, triggered_at` (INSERT); `SELECT id FROM alerts WHERE alert_type/resource_type/resource_id/is_active/triggered_at` (dedup check) | ✅ all present |
| `src/workers/anomaly.detection.ts` | Calls the above via `AnomalyDetector.detectAnomalies()` on a 15-minute interval, started at server boot | ✅ no direct schema dependency beyond the above |
| `alerts.controller.ts` `getActiveAlerts`/`getAlertById` | `id, alert_type, severity, title, message, current_value, threshold_value, baseline_value, resource_type, resource_id, is_active, triggered_at, acknowledged_at, resolved_at` | ✅ all present |
| `alerts.controller.ts` `acknowledgeAlert`/`dismissAlert` | `UPDATE ... SET acknowledged_at/resolved_at/acknowledged_by/updated_at/is_active WHERE id` | ✅ all present |
| `alerts.controller.ts` `getAlertStats` | `COUNT(*) FILTER (WHERE is_active/severity), resolved_at` | ✅ all present |
| `metrics.broadcaster.ts` `getActiveAlertStats` | `COUNT(*) FILTER (WHERE severity) ... WHERE is_active = true` | ✅ present; also confirmed the `42P01`-specific workaround (`error?.code === '42P01'`) simply stops triggering once the table exists — no code change needed there, it degrades gracefully either way |
| `websocket.service.ts` | No schema dependency — pure Socket.io broadcast, `alert: any` | ✅ n/a |
| `useRealtimeMetrics.ts` (admin-dashboard) | Listens for `alert-acknowledged`/`alert-triggered`/`alert-dismissed` socket events, no direct DB dependency | ✅ n/a (depends on the broadcast wiring fixed in §3, not on the table shape) |

No column, type, or constraint mismatch found anywhere. The only real gap was the broadcast wiring (§3), not the schema.

## 5. Tests added and results

Real, runnable Jest tests (this codebase's actual test infrastructure), all passing:

```
PASS src/services/anomaly.detector.test.ts        (3 tests)
PASS src/api/v1/alerts/alerts.controller.test.ts   (5 tests)
PASS src/workers/metrics.broadcaster.test.ts       (2 tests)
```

Covering: `createAlert` persists correctly and skips duplicates (mocked `query`, exercising the method directly since it's a private class method — a standard, encapsulation-preserving test pattern, no source visibility was weakened for this); `createAlert` still fails safely (no throw) if the insert ever errored again; `GET /api/v1/alerts` shapes rows correctly; `acknowledgeAlert` writes `req.user.id` as `acknowledged_by` **and** now calls the broadcast; same for `dismissAlert`; `getAlertStats` reads real counts; `metrics.broadcaster.getActiveAlertStats` returns real counts on the happy path and still degrades gracefully if `42P01` ever recurred.

Full API suite re-run after these changes: **14 suites, 49 tests, all passing** (no regressions — confirmed via `npm run type-check` clean and `npx jest` full run).

**What these tests do *not* prove**, and why: they verify the *application code* issues the right SQL and calls the right functions, using mocked `query`/`webSocketService` — the same pattern every other controller test in this codebase already uses. They do not, and cannot, prove PostgreSQL itself will accept the migration's DDL, enforce the FK, or handle `ON DELETE SET NULL` correctly — that requires a real database, which is what §6 is for.

## 6. Migration-level test script (cases A-G)

`tech-tools-api/scripts/test-040-repair-migration.sh` — a self-contained script that spins up a throwaway PostgreSQL 15 container, builds the minimal precondition matching production's *actual* confirmed state (a `users` table and `alert_severity_enum` type exist; `admins`/`alerts` do not — per `docs/PRODUCTION-026-DRIFT-RECONCILIATION.md`), then runs all seven cases (A: creates successfully · B: re-running is a no-op, not an error · C: succeeds with no `admins` table present · D: valid `users.id` accepted · E: an unknown UUID is rejected by the FK · F: deleting the referenced user nulls `acknowledged_by` · G: statically confirms the migration file never references `user_sessions`/`events_core`/`event_aggregates_hourly`).

**Important limitation, stated plainly:** I could not execute this script myself. This sandbox has the `docker` CLI installed but no reachable daemon (confirmed by attempting it directly — `dial unix /var/run/docker.sock: connect: no such file or directory` — and there's no way for me to start one here). I verified the script's bash syntax (`bash -n`, clean) and hand-traced every command against documented `psql`/PostgreSQL behavior, but **it has not actually been run against a real PostgreSQL instance by me or anyone**. Please run it yourself — on your local machine or anywhere else `docker` actually works (it never touches any real database; everything it creates is a uniquely-named, throwaway container it also tears down on exit) — before treating cases A-G as confirmed:

```bash
cd tech-tools-api
./scripts/test-040-repair-migration.sh
```

## 7. Exact safe apply command (for you to run, not me)

Once §0's reconfirmation and §6's script both check out:

```bash
# Standard, tracked, transactional path -- inserts into schema_migrations
# on success, matching every other migration that's landed so far.
npm run migrate:up
```

Run from `tech-tools-api/` against production, using whatever mechanism you already use for that (per the earlier audit, this is normally a manual step — there's no CI/CD auto-migration in this repo). This applies **only** `040` (the one pending file) — `migrate.ts` processes filenames not yet in `schema_migrations`, and nothing else is pending as of the `039` confirmation.

## 8. Post-apply verification commands (read-only, run after §7)

```bash
# 1. Confirm it's recorded
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at FROM schema_migrations
WHERE filename = '"'"'040_repair_unified_analytics_alerts.sql'"'"';
"'

# 2. Confirm alerts exists, and its columns
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '"'"'alerts'"'"'
ORDER BY ordinal_position;
"'

# 3. Confirm acknowledged_by targets users(id), not admins(id)
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = '"'"'alerts'"'"' AND tc.constraint_type = '"'"'FOREIGN KEY'"'"';
"'

# 4. Confirm the five expected indexes exist
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT indexname FROM pg_indexes WHERE tablename = '"'"'alerts'"'"' ORDER BY indexname;
"'

# 5. Row count (expected: 0 immediately after migration -- it is a brand-new,
#    empty table; a nonzero count would mean something unexpected inserted
#    into it between apply and this check)
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT count(*) FROM alerts;
"'

# 6. Confirm no admins table was introduced
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT to_regclass('"'"'public.admins'"'"') AS admins_table_exists;
"'
```
All six are plain `SELECT`s against schema metadata and one empty-table row count — no PII, no credentials, nothing beyond what was already surfaced in the original migration-state check.

## 9. Rollback procedure

**This is not symmetric before vs. after real alert rows exist — treated separately, per your instruction not to describe `DROP TABLE` as casually harmless.**

**Before the anomaly-detection worker has written anything (immediately post-apply, verified via §8 query 5 returning `0`):**
```sql
DROP INDEX IF EXISTS idx_alerts_alert_type, idx_alerts_severity, idx_alerts_is_active, idx_alerts_triggered_at, idx_alerts_resource;
DROP TABLE IF EXISTS alerts;
```
Safe — nothing else references `alerts` (no other table has an FK to it), and there's no data yet to lose. Leave `alert_severity_enum` in place regardless (it's shared/harmless, and dropping a type is a separate, riskier operation this rollback doesn't need to touch).

**After real alert rows exist** (the anomaly-detection worker runs every 15 minutes, so this window is short — likely under 15 minutes after apply): do **not** treat `DROP TABLE` as a casual rollback anymore. First export what's there:
```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\copy (SELECT * FROM alerts) TO STDOUT WITH CSV HEADER" ' > alerts-backup-$(date +%Y%m%d-%H%M%S).csv
```
Then decide based on *why* you're rolling back:
- **If `040` itself turns out to be wrong** (e.g. a column type issue nobody caught) — prefer a **forward fix** (a `041`-numbered corrective migration, or resequence if `041` hasn't been claimed by staff_memberships yet) over dropping the table, exactly as this repair itself was handled for `026`. Real alert rows are operationally valuable (anomaly history) and shouldn't be discarded to fix a schema mistake that can be patched forward instead.
- **If you genuinely need the table gone** (e.g. decided alerts isn't wanted after all) — only then `DROP TABLE alerts` (with the exported CSV as your recovery path if that decision is reversed later), and separately revert the `alerts.controller.ts`/`metrics.broadcaster.ts`/`anomaly.detector.ts` code changes so the app doesn't immediately start erroring against a table that no longer exists (the `42P01` graceful-degradation path in `metrics.broadcaster.ts` would keep that one call site safe, but `alerts.controller.ts`'s REST endpoints would start 500ing again, exactly as they did before this repair).
- In neither case should `schema_migrations`' `040` row be deleted — that would make the tracked runner think `040` is pending again and re-attempt it, which is a bigger foot-gun than leaving a harmless "yes, this ran once" record in place even if the table is later dropped by choice.

## 10. Risks

- Not executed against a real PostgreSQL instance by anyone yet (§6) — the single biggest open risk, and squarely why §6/§7 are sequenced before §7 actually runs.
- `alert_severity_enum`'s continued existence in production is inferred, not directly confirmed (types survive their using table being dropped, per standard Postgres behavior, but this was never independently checked with a read-only query) — the migration's `DO $$ ... IF NOT EXISTS` guard makes this a non-issue either way, but worth knowing it's inference, not observation.
- The `createAlert` new-alert broadcast gap (§3) remains open — low risk (doesn't block the repair, doesn't affect data correctness), but means live "new alert" push notifications to the admin dashboard still won't fire even after `040` lands, only acknowledge/dismiss will.
- Standard migration risk: this is still a schema change against a live production database, however small and however additive — the founder-applied, manually-verified sequence in §7/§8 is intentional, not a formality.

## 11. Exact next step for MARKET-OPS-1

Unchanged from the prior phase: once `040` is applied and verified (§8), the next-free migration number must be **re-confirmed against `schema_migrations`** (not assumed to be `041`, even though that's the expected outcome) before `staff_memberships` is written. `docs/GLOBAL-COMMERCE-ARCHITECTURE.md` remains paused behind both `040` and `041` landing, per your standing instruction — nothing in this phase changes that sequencing.

---

## Status

**BLOCKED — pending two things only you can do:** (1) run `./tech-tools-api/scripts/test-040-repair-migration.sh` somewhere Docker actually works and confirm all seven cases pass, since I could not execute it myself in this environment; (2) re-run the §0 reconfirmation command and confirm `039` is still the latest recorded migration.

Once both check out, this becomes **READY FOR FOUNDER TO APPLY 040** — nothing else in this report is a blocker; the migration file, the application-code fix, and the test suite are all complete and verified as far as they can be verified without a live database.
