# 041 Staff Memberships — Implementation Report

**Status: nothing has been applied to production.** `041_staff_memberships.sql` exists only as a file in this repository. No employee account has been granted anything — every test in this report runs against mocked data or fixtures, never a real person's account.

---

## Part A — Reconfirm the migration number

Production `schema_migrations` was confirmed through `040_repair_unified_analytics_alerts.sql` in the prior phase (verified: `alerts` table exists with 17 correct columns, 6 correct indexes, `acknowledged_by` correctly referencing `users(id)`, no `admins` table). Before applying `041`, re-run:

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at
FROM schema_migrations
ORDER BY id DESC
LIMIT 5;
"'
```

If `040_repair_unified_analytics_alerts.sql` is still the latest row, `041_staff_memberships.sql` is confirmed as the correct, unused next filename and everything below stands. If anything else has landed since, stop and resolve that before applying.

---

## 040 test-script path discrepancy — investigated and fixed

**Root cause:** not a bug in `tech-tools-api/scripts/test-040-repair-migration.sh` itself — the script's internal path resolution (based on its own `$0` location) was correct. The founder ran `./scripts/test-040-repair-migration.sh` from the **repo root**, where no such path exists; the script lives under `tech-tools-api/scripts/`. Bash's "No such file or directory" was reported for the script file itself, before any of the script's own logic ever executed.

**A much more significant, related issue found while investigating:** `server-scripts/migrate.sh` — the script actually used to apply `040` — piped each migration file into `psql` **without `-v ON_ERROR_STOP=1`**. Without that flag, psql continues past a failing statement and still reports overall success, so a mid-file error doesn't stop the script or prevent `schema_migrations` from recording the file as executed. This is almost certainly the real, mundane explanation for the original `026`/`alerts` drift documented in `docs/PRODUCTION-026-DRIFT-RECONCILIATION.md` — no need for that document's more speculative "an `admins` table existed transiently" theory. It was also a **live risk for `041` and every future migration** applied via this script.

**Fixed** (not migration `040` itself, which is untouched): `server-scripts/migrate.sh`'s `run_sql()` now always passes `-v ON_ERROR_STOP=1`, and `run_migration()`/`migrate_force()` now use `-1` (single-transaction) with `-f -`, matching `migrate.ts`'s existing atomicity guarantee — any statement failure now aborts the whole file, rolls it back, and the migration is correctly **not** recorded as executed. Also hardened `tech-tools-api/scripts/test-040-repair-migration.sh` with a clear invocation check that fails with a helpful message instead of a confusing one if run from the wrong path.

---

## Migration (`041_staff_memberships.sql`)

Additive only — creates `staff_role` enum, `staff_membership_status` enum, `staff_memberships`, `staff_audit_log`, and their indexes. Does not touch `users`, does not touch `users.user_type`, does not touch any already-applied migration.

**Key design decisions:**
- `market_scope TEXT[]`, per the phase brief — not yet normalized into a join table (no `countries` table exists to reference; see `docs/GLOBAL-COMMERCE-ARCHITECTURE.md` §19 for the documented future path). `NULL` = global scope; a non-null array (including an explicitly empty one) = restricted, and an empty array fails closed rather than being treated as global — this distinction was caught and fixed during test-writing (see Tests, below).
- Uniqueness is a **partial** index — `UNIQUE (user_id, role) WHERE status IN ('ACTIVE','SUSPENDED')` — not a blanket constraint. A blanket `UNIQUE(user_id, role)` would permanently block re-granting a role to someone whose prior grant was revoked; `REVOKED` is terminal and frees the slot.
- `staff_audit_log` is immutable by convention (no application code issues `UPDATE`/`DELETE` against it) and never stores passwords, JWTs, refresh tokens, API keys, or payment credentials — `metadata` is restricted at the application layer to operational context only.

---

## API changes

New router mounted at `/api/v1/staff` (`tech-tools-api/src/api/v1/staff/`):

| Method | Path | Permission gate |
|---|---|---|
| GET | `/staff/me` | `authenticate` only — self-service, any authenticated user can check their own staff status |
| GET | `/staff` | `staff.view` or legacy `super_admin` |
| GET | `/staff/:id` | `staff.view` or legacy `super_admin` |
| GET | `/staff/:id/audit-log` | `staff.view` or legacy `super_admin` |
| POST | `/staff` (grant) | `staff.grant` or legacy `super_admin` |
| PATCH | `/staff/:id/role` | `staff.manage` or legacy `super_admin` |
| PATCH | `/staff/:id/market-scope` | `staff.manage` or legacy `super_admin` |
| POST | `/staff/:id/suspend` | `staff.manage` or legacy `super_admin` |
| POST | `/staff/:id/reactivate` | `staff.manage` or legacy `super_admin` |
| POST | `/staff/:id/revoke` | `staff.revoke` or legacy `super_admin` |

**The "or legacy `super_admin`" bootstrap path exists for a specific reason:** immediately after `041` lands, zero `staff_memberships` rows exist. A pure permission-based gate on the staff-management routes would lock out everyone, including the founder's own existing `super_admin` account, with no way to ever create the first grant. This isn't a new privilege — legacy `super_admin` is already the highest trust level in the current system; this lets it continue administering the new one too, matching "legacy admins must continue working."

**Mutation-specific rules, enforced inside the controllers (not just the route gate):**
- No self-service: every mutation endpoint rejects if the target is the caller themselves (`403`).
- No privilege escalation: `ROLE_AUTHORITY_RANK` (`OWNER` 100 → `SUPER_ADMIN` 90 → `ADMIN` 70 → `MARKET_MANAGER`/`CATALOG_MANAGER`/`ORDER_MANAGER`/`MARKETING_MANAGER` 40-50 → `SUPPORT_AGENT` 30) — an actor can never grant, modify, suspend, or revoke a role with more authority than their own highest active role (legacy `super_admin` is exempt from this specific check, since it's already unconstrained today).
- Last-owner lockout prevention: suspending, revoking, or demoting an `OWNER`/`SUPER_ADMIN` membership is blocked if it would leave zero active `OWNER`/`SUPER_ADMIN` memberships remaining.
- Grants only ever target an **existing** user (`SELECT ... WHERE id/email = $1 AND is_active = true`) by ID or verified email — never creates a user row.
- Every mutation writes a `staff_audit_log` entry with before/after state, wrapped so a logging failure never breaks the actual request (same fire-and-forget pattern already used for notification dispatch elsewhere in this codebase).
- Every response is redacted to `id, email, firstName, lastName, legacyUserType, role, status, marketScope, granted*, suspended*, revoked*, created/updated_at` — never `password_hash` or anything beyond that.

---

## Permission matrix

Enforced entirely in code (`tech-tools-api/src/config/staff-permissions.config.ts`), **not** a seeded database table — deliberately, to avoid repeating the exact mistake found in the original audit: `admin_permissions`/`admin_role_permissions` were seeded once and never actually wired to any request-time check.

| Permission | OWNER/SUPER_ADMIN | ADMIN | MARKET_MANAGER | CATALOG_MANAGER | ORDER_MANAGER | MARKETING_MANAGER | SUPPORT_AGENT |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| dashboard.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| analytics.view / view_global | ✅ | ✅ | — | ✅ | ✅ | ✅ | — |
| analytics.view_market | ✅ | — | ✅ | — | — | — | — |
| orders.view / manage | ✅ | ✅ | ✅ (scoped) | — | ✅ | — | view only |
| orders.cancel / refund | ✅ | ✅ | — | — | ✅ | — | — |
| customers.view | ✅ | ✅ | ✅ (scoped) | — | ✅ | — | ✅ |
| customers.manage / view_pii | ✅ | ✅ | — | — | — | — | — |
| catalog.view / manage / publish | ✅ | ✅ | — | ✅ | — | view only | — |
| inventory.view / manage | ✅ | ✅ | view only (scoped) | ✅ | view only | — | — |
| suppliers.view / manage / import | ✅ | ✅ | ✅ (scoped) | ✅ | — | — | — |
| marketing.view / manage | ✅ | ✅ | view only | — | — | ✅ | — |
| campaigns.view / manage | ✅ | ✅ | — | — | — | ✅ | — |
| support.view / manage | ✅ | ✅ | ✅ (scoped) | — | — | — | ✅ |
| shipping.view / manage | ✅ | ✅ | — | — | view only | — | — |
| staff.view | ✅ | ✅ | — | — | — | — | — |
| staff.manage / grant / revoke | ✅ | — | — | — | — | — | — |
| settings / payments / security (.view/.manage) | ✅ | — | — | — | — | — | — |

`MARKET_MANAGER` is deliberately the most restricted of the operational roles, per the phase brief's explicit Phase-1 policy: no refunds, no catalog mutation, no shipping/payment configuration, no staff access. The full allow-list matches the brief exactly (`dashboard.view`, `analytics.view_market`, `orders.view/manage`, `customers.view`, `inventory.view`, `suppliers.view/manage`, `marketing.view`, `support.view/manage`) — nothing broader was added speculatively.

---

## Market-scope implementation

`applyMarketScope(req, resource, paramIndex)` (`tech-tools-api/src/middleware/staff.ts`) builds a SQL `WHERE` fragment from the caller's active memberships:
- If **any** active membership has `market_scope IS NULL`, access is global — a scoped role never quietly narrows access already granted globally by another role the same person also holds.
- Otherwise, the filter is the union of all scoped country codes across every active membership.
- If scope resolves to an empty set (an explicitly empty array, distinct from `NULL`), it **fails closed** (`1 = 0`) rather than open.
- Two resource expressions are defined: `orders` (`shipping_address->>'country'`) and `suppliers` (`country_code`), matching the columns identified in the original `MARKET-OPS-STAFF-ACCESS-AUDIT.md` design.

**Scope of what shipped this phase:** `applyMarketScope` is implemented and unit-tested as a reusable utility (5 dedicated tests covering global/scoped/mixed/empty-scope/resource-expression cases). It has **not** been wired into the existing `orders`/`suppliers` admin-listing controllers yet — that's real production-surface retrofit work, appropriately deferred to when a real `MARKET_MANAGER` is actually being onboarded (matching the phased delivery strategy), not required to prove the authorization foundation itself works correctly.

---

## Security model

- **Server-side only.** Every permission check happens in `requireStaff`/`requirePermission`/`requirePermissionOrLegacyRole` middleware on the API, never trusted from the frontend. The admin-dashboard's `PermissionGate` component and permission-filtered sidebar are rendering conveniences — explicitly documented in their own code comments as not a security boundary.
- **No self-lockout, no self-escalation** — see API changes above.
- **Bootstrap path is scoped narrowly** — only legacy `super_admin` (not `admin`) can bootstrap staff management, matching "Only OWNER/SUPER_ADMIN can perform high-risk staff mutations initially."
- **PERMISSION_DENIED is audited** — every `403` from `requireStaff`/`requirePermission` writes a `staff_audit_log` entry (actor, the check that failed, timestamp) — fire-and-forget, never blocks the response.

---

## Staff / Organization UI

`admin-dashboard/app/(dashboard)/organization/staff/page.tsx` — list + filter (status/role) + a detail side panel (Sheet) per membership showing role/status/market scope/grant date and recent audit activity, with Suspend/Reactivate/Revoke actions and a "Grant Staff Access" dialog (targets an existing user by email or ID — the form makes no provision for creating a new account). The existing legacy "Admins" page is untouched, per the explicit instruction not to throw it away.

---

## Navigation behavior

- A new **Organization → Staff** sidebar entry, visible only to callers with `staff.view` (legacy `admin`/`super_admin` always see it, matching their existing unrestricted access to everything else in the dashboard).
- **Settings** is now gated behind `settings.view` — the concrete instance of "a SUPPORT_AGENT must not see Stripe configuration simply because the sidebar contains that link." Every other existing nav item is intentionally left ungated this phase (see the Admin Platform 2.0 roadmap for the incremental plan) — retrofitting permission requirements onto ~25 existing links individually is real, separate work, not required to establish the pattern.
- **A new Command Center page** (`/command-center`, linked from the sidebar) — the shell this phase's brief asked for, not a full redesign of `/dashboard` (which is untouched, so nothing about today's default landing experience changes).

**A gap this required fixing to work end-to-end:** `AuthContext.login()` previously rejected any `user_type` that wasn't `admin`/`super_admin` outright — meaning a `MARKET_MANAGER` (whose `user_type` correctly stays `customer`) could never log into the dashboard at all, making the entire staff system unreachable through the UI regardless of how correct the backend was. Fixed: login (and session-restore on page load) now also checks `GET /staff/me` when the legacy `user_type` isn't admin/super_admin, and proceeds if at least one active staff membership exists. The dashboard-access cookie (`docs/LAUNCH-FOUNDATION-1-REPORT.md`'s coarse, non-HttpOnly gate) now accepts a third marker value, `'staff'`, alongside the existing `admin`/`super_admin` values, so `middleware.ts`'s server-side shell guard recognizes staff-only sessions too.

---

## Tests

**Backend — 29 new tests, all passing** (full suite: 16 suites, 78 tests, no regressions):
- `src/middleware/staff.test.ts` (16 tests) — `requireStaff`/`requirePermission`/`requirePermissionOrLegacyRole`/`applyMarketScope`, including: legacy `super_admin` passes without any `staff_memberships` row; a plain customer with none is rejected; a role/permission not granted (e.g. `MARKET_MANAGER` + `orders.refund`) is rejected; the global-vs-scoped-vs-empty-scope market filter logic (the bug caught and fixed mid-development, see below).
- `src/api/v1/staff/staff.controller.test.ts` (13 tests) — grant targeting an existing user only (never creates one); self-grant rejected even for an `OWNER`; granting/promoting beyond the actor's own authority rejected; demoting/suspending/revoking the last `OWNER`/`SUPER_ADMIN` rejected; suspend/reactivate/revoke status-transition guards; audit entries written with correct before/after state.

**A real design bug caught while writing tests, not just exercised by them:** the first `applyMarketScope` implementation treated an explicitly-empty `market_scope` array the same as `NULL` (both "global"), which made the documented "fails closed" behavior for an empty scope literally unreachable code. Fixed before shipping — `NULL` means global, a non-null array (even empty) means restricted, and empty resolves to "matches nothing" — and the migration's own column comment was updated to match, so the schema, the code, and its tests now agree.

**What Part X asked for, mapped to what's covered:**
- Legacy `super_admin` still works ✅ (`requirePermissionOrLegacyRole` test)
- Normal customer cannot access staff APIs ✅ (`requireStaff`/`requirePermission` reject-with-no-memberships tests)
- `MARKET_MANAGER` allowed routes work / forbidden routes 403 ✅ (`requirePermission` allow/deny tests using the real matrix)
- Scope filters applied ✅ (`applyMarketScope` unit tests; end-to-end wiring into a real controller is explicitly deferred, see Market-scope implementation above)
- Suspended/revoked access denied ✅ (the loader query filters `WHERE status = 'ACTIVE'`; tested directly)
- Privilege escalation rejected ✅ (rank checks, self-target checks, last-owner guard)
- Staff audit written correctly ✅ (asserted on every mutation test)
- Global admin unaffected ✅ (nothing in `authenticate()`/`authorize()` was touched; full existing suite still passes unmodified)

**Not covered by an automated test, and why:** whether a `MARKET_MANAGER` can actually complete a real login-to-dashboard session end-to-end (the `AuthContext`/cookie/middleware chain) — this is a browser-level flow this environment has no way to drive automatically; `npm run build` confirms it compiles and the route tree generates correctly, but a real click-through wasn't performed. Recommend a manual pass with a test fixture account before treating this as fully proven (see Remaining blockers).

---

## Exact pre-apply production check

Part A's command, above — re-run immediately before applying, not relied on from an earlier turn in this conversation.

## Exact safe apply procedure

```bash
cd /root/Enterprise-Grade-E-commerce
./server-scripts/migrate.sh up
```

This now uses the fixed, fail-closed `run_sql`/`run_migration` (`-v ON_ERROR_STOP=1 -1`) — if anything about `041` is wrong, it will abort and roll back cleanly instead of silently partially applying, unlike what happened historically with `026`.

## Post-apply verification (read-only)

```bash
# 1. Confirm it's recorded
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at FROM schema_migrations
WHERE filename = '"'"'041_staff_memberships.sql'"'"';
"'

# 2. Confirm the tables and enum exist with the right columns
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '"'"'staff_memberships'"'"'
ORDER BY ordinal_position;
"'

# 3. Confirm zero rows (nobody has been granted anything yet)
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT count(*) FROM staff_memberships;
"'

# 4. Confirm the partial unique index exists
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = '"'"'staff_memberships'"'"' AND indexname = '"'"'ux_staff_memberships_user_role_current'"'"';
"'
```

## Rollback

Both new tables are additive, empty on creation, and nothing else in the schema references them (no existing table has an FK to `staff_memberships`/`staff_audit_log`), so — **as long as no real grant has been made yet** — rollback is unconditionally safe:
```sql
DROP TABLE IF EXISTS staff_audit_log;
DROP TABLE IF EXISTS staff_memberships;
DROP TYPE IF EXISTS staff_membership_status;
DROP TYPE IF EXISTS staff_role;
```
Once a real grant exists, treat it the same way `040`'s report treats real alert rows: export first (`\copy (SELECT * FROM staff_memberships) TO STDOUT WITH CSV HEADER`), prefer a forward-fixing migration over dropping, and never delete the `041` row from `schema_migrations` even if the tables are eventually dropped by choice.

---

## Remaining blockers

None block applying `041` itself. Worth doing before onboarding a real employee, in order:
1. A manual, fixture-account login walkthrough of the `MARKET_MANAGER` → dashboard flow (see Tests, above) — the automated suite proves every piece in isolation, not the full browser session.
2. Wiring `applyMarketScope` into the real `orders`/`suppliers` admin-listing controllers (currently a tested-but-unwired utility).
3. Everything in the Admin Platform 2.0 roadmap's later phases (Analytics 2.0, role-specific home screens, global activity feed) — none of it blocks `041`, all of it makes the staff system more useful once real people are using it.

---

## Status

**READY FOR FOUNDER TO APPLY 041**
