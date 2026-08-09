# ADMIN-2A.5 — Real Staff Access Integration + Security Retrofit

**Phase:** ADMIN-2A.5 (workstream A of "ADMIN-2A.5 + LOCALIZATION-FOUNDATION-1")
**Status of prerequisite work:** `041_staff_memberships.sql` and the ADMIN-2A staff foundation (permission matrix, `requireStaff`/`requirePermission`/`requirePermissionOrLegacyRole`, Staff UI) were implemented and applied in prior phases — see `docs/041-STAFF-MEMBERSHIPS-IMPLEMENTATION-REPORT.md`.
**No real employee was onboarded in this phase.** No migration `042` was created. `041` was not modified. `users.user_type` was not modified.

---

## Part 0 — Production migration state

`041` was already confirmed applied to production earlier in this engagement: the founder ran `./server-scripts/migrate.sh up` over SSH, it succeeded, and a post-apply verification query confirmed `staff_memberships`/`staff_audit_log`'s schema matched the migration file exactly (partial unique index, `market_scope TEXT[]`, all FKs). This was reconfirmed indirectly this phase — every controller/route change below was written and tested against that exact schema, and `npx jest`/`tsc --noEmit` pass cleanly against it.

For the founder's own re-verification at any time, the exact read-only command:

```sql
SELECT id, filename, executed_at
FROM schema_migrations
ORDER BY id DESC
LIMIT 5;
```

Run via (matching the existing pattern in `docs/PRODUCTION-MIGRATION-STATE-CHECK.md`):

```bash
docker exec -it techtools-postgres-prod sh -c '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 5;
"'
```

Expect `041_staff_memberships.sql` at (or near) the top. If it is **not** present, everything in this report that depends on `staff_memberships` existing (all of it) is inert until the founder applies `041` — no code in this phase assumes it silently; `requireStaff`/`requirePermission` simply return empty results and every staff-gated route correctly denies everyone but legacy admins in that case (fails closed, not open).

No new migration was created or is needed this phase.

---

## 1. Controllers/endpoints changed

### Orders (`tech-tools-api/src/api/v1/orders/`)
- `order.routes.ts` — every `/admin/*` route changed from `authorize('admin', 'super_admin')` to `requirePermissionOrLegacyRole('orders.view' | 'orders.manage', 'admin', 'super_admin')`. This is what makes these routes reachable by staff at all; legacy admin/super_admin behavior is unchanged (same bootstrap pattern as `staff.routes.ts`).
- `order.controller.ts`:
  - New `assertOrderInScope(req, orderId)` helper — the IDOR guard for `:id` routes.
  - `getAdminOrders` — `applyMarketScope()` folded into the list `WHERE` clause and the count query.
  - `getAdminOrderById` — 404s (not 403, matching this codebase's existing ownership-check convention) if the order's country is outside the caller's scope; audits the denial.
  - `getOrderStats` — all 4 internal aggregate queries scoped.
  - `adminUpdateOrderStatus` — scope guard (404) + a new **explicit `orders.refund` permission check** independent of `orders.manage` (see §2).
  - `bulkUpdateOrderStatus` — scope folded into the bulk `UPDATE ... WHERE id IN (...)`, so out-of-scope IDs in a batch are silently excluded from the update (not attempted then rejected) and the discrepancy is audited.
  - `updateOrderShipping` — scope guard added.
  - `exportOrders` — scope folded into the export query.

### Suppliers (`tech-tools-api/src/api/v1/suppliers/`)
- `supplier.routes.ts` — replaced the blanket `router.use(authenticate, authorize('admin','super_admin'))` gate with per-route `requirePermissionOrLegacyRole('suppliers.view' | 'suppliers.manage' | 'suppliers.import', ...)`. Product-economics/auto-pause endpoints (`/products/:id/economics`, `/products/:id/auto-pause/evaluate`, `/ops/auto-paused`) were deliberately **left legacy-admin-only** — see §9.
- `supplier.controller.ts` — new `assertSupplierInScope()` helper (mirrors `assertOrderInScope`); wired into `getSuppliers` (list), `getSupplierById`, `updateSupplier`, `deleteSupplier`, `syncSupplierProducts`, `getSupplierProducts`, `upsertSupplierProductOffer`.
- `supplier-import.controller.ts` — `previewSupplierImport` and `commitSupplierImport` both now check the target supplier's country against the caller's scope before doing anything else.

### Analytics (`tech-tools-api/src/api/v1/analytics/`)
- `analytics.routes.ts` — added `GET /analytics/market-overview`, gated by `analytics.view_market`. All pre-existing global analytics endpoints (`revenue-trend`, `top-products`, `visitors/*`, `channels`, etc.) are **unchanged** — still legacy-admin-only, deliberately not extended to staff (see §5).
- `analytics.controller.ts` — new `getMarketOverview()`: scoped visitor/session counts (`user_sessions.country_code`), scoped order count/revenue (via `applyMarketScope`), scoped supplier count. Fails closed on an empty `market_scope`; returns unfiltered figures only for a caller holding a global (`market_scope IS NULL`) membership.

### Middleware (`tech-tools-api/src/middleware/staff.ts`)
- New `isCountryInScope(req, countryValue)` — the shared IDOR-guard primitive every `assert*InScope` helper above calls.
- `applyMarketScope()`'s country-matching now goes through `expandCountryScopeForMatching()` (new: `tech-tools-api/src/config/country-reference.config.ts`) instead of raw ISO codes — see §3.

---

## 2. Scope rules (what "market-scoped" actually means here)

- A staff member's **union of all ACTIVE memberships'** `market_scope` determines their effective scope. If **any** ACTIVE membership has `market_scope IS NULL`, the caller is global for that resource — a scoped role must never be able to accidentally narrow access already granted globally by a different role the same person holds.
- `NULL` = global. A non-null array **including an explicitly empty array** = restricted; an empty array fails **closed** (`AND 1 = 0` / "matches nothing"), never open. This was deliberately tested (`applyMarketScope`/`isCountryInScope`/`getMarketOverview` all have a dedicated empty-scope test).
- Every list/aggregate endpoint uses `applyMarketScope(req, resource, paramIndex)`, which returns a SQL fragment + params to fold into an existing `WHERE`/query — enforcement is in the SQL, never "fetch everything then filter in the response."
- Every `:id`-based read or mutation additionally calls `isCountryInScope()` (via a resource-specific `assert*InScope` helper) against the specific row fetched — this is the IDOR guard. **List-level filtering alone is not sufic ient**; a scoped caller who already knows/guesses an out-of-scope UUID must still be denied. Confirmed with dedicated tests (CM manager requesting an IT order/DE supplier by ID → 404).
- `orders.refund` is enforced as its own permission, separate from `orders.manage`. MARKET_MANAGER holds `orders.manage` (can update status/shipping) but **not** `orders.refund` — without the explicit check added to `adminUpdateOrderStatus`/`bulkUpdateOrderStatus`, holding the broader `orders.manage` would have implicitly allowed marking orders `refunded`, which violates the explicit "MARKET_MANAGER has NO refunds" requirement. This was a self-identified gap, not called out by file/line in the original spec, but follows directly from the stated requirement plus the existing permission matrix.
- Denials are audited via `recordStaffAuditEvent()` (fire-and-forget, never blocks the real request) with: actor, permission/check name, resource type, resource ID, requested country/market — **never** the full order/customer/supplier payload.

---

## 3. Country-value findings

**Production query provided to the founder (SELECT-only, no PII):**

```sql
SELECT
  shipping_address->>'country' AS country_value,
  COUNT(*) AS order_count
FROM orders
WHERE shipping_address ? 'country'
GROUP BY shipping_address->>'country'
ORDER BY order_count DESC;
```

This has **not** been confirmed run against production this session — it's handed off here for the founder to run and report back, per the explicit "do not guess" instruction. What was investigated instead: the actual storefront checkout code (`e-commerce-web-store`), which submits `shipping_address.country` from a `<select>` populated by `src/data/countries.ts` — a list of `{code, name}` pairs whose `<option value>` is the ISO alpha-2 **code**. This strongly suggests current/recent orders store ISO codes (`"CM"`, `"IT"`, `"US"`), but says nothing about **historical** data, which may predate this checkout implementation or have been entered differently.

**Because the real format isn't confirmed, the scope-matching layer is deliberately format-agnostic**, not a guess:

- `tech-tools-api/src/config/country-reference.config.ts` — a ~180-entry `{code, name}` table ported verbatim from the storefront's own `countries.ts` (the actual list the real checkout uses, so it can't drift from what customers actually see).
- `expandCountryScopeForMatching(isoCodes)` — given a staff member's scope (ISO codes, e.g. `['CM']`), returns a lowercased array containing **both** the code and its known full name (`['cm', 'cameroon']`), for a `LOWER(col) = ANY($n)` filter that matches either stored format.
- Every scope-matching SQL expression (`orders.shipping_address->>'country'`, future resources) is wrapped in `LOWER(...)` and matched against this expanded set — never a hardcoded `if country === 'Cameroon'`.
- This is explicitly documented in the code as a **temporary bridge** pending the real `countries` table from `docs/GLOBAL-COMMERCE-ARCHITECTURE.md`.

`suppliers.country_code` was treated as trustworthy as-is (it's an admin-entered, not customer-entered, field with a `COALESCE(..., ...).toUpperCase()` write path in `supplier.controller.ts` — see `createSupplier`/`updateSupplier`), so the same expansion is applied there too for consistency/safety, but is less likely to matter in practice.

---

## 4. Permission-to-page mapping (sidebar + direct routes)

| Nav item | Permission | Sidebar gated | Page-level guard |
|---|---|---|---|
| Products (parent) | *(ungated — children vary)* | — | — |
| ↳ All Products / Add Product / Categories / Collections | `catalog.view` | ✅ | not built this phase (catalog pages out of explicit scope) |
| ↳ Suppliers | `suppliers.view` | ✅ | ✅ `RequirePagePermission` on `/suppliers` |
| Sales (parent) | *(ungated — children vary)* | — | — |
| ↳ Orders | `orders.view` | ✅ | ✅ `/dashboard/orders` |
| ↳ Customers | `customers.view` **+ legacyOnly** | ✅ | ✅ `/dashboard/customers` (see §9 — global directory) |
| ↳ Shipping | `shipping.view` | ✅ | ✅ `/dashboard/shipping` |
| Marketing (parent + Promotions/Coupons) | `marketing.view` | ✅ | ✅ `/dashboard/coupons` (Promotions page doesn't exist yet) |
| Analytics | `analytics.view` (global page only — see §5) | ✅ | ✅ `/dashboard/analytics` |
| Organization → Staff | `staff.view` | ✅ (pre-existing) | ✅ pre-existing `PermissionGate` inline-denial |
| Settings | `settings.view` | ✅ (pre-existing) | ✅ `/dashboard/settings` |
| Admins (legacy admin management) | *(legacyOnly, no staff permission — see below)* | not sidebar-gated this phase | ✅ `/dashboard/admins` |
| Command Center | *(role-aware rendering, not gated)* | — | see §7 |

`Admins` manages the **legacy** `users.user_type = admin/super_admin` accounts — a different system from `staff_memberships`, with no corresponding entry in the staff permission matrix. Gated `legacyOnly` (not by any staff permission) since granting staff access to it would be granting a new privilege that doesn't exist in the matrix, not extending an existing one.

Items intentionally **not** gated this phase (unchanged from before): Dashboard, Command Center (role-aware content instead — see §7), Books, Sellers, Media Library, Blog, Trending, Communication (Email/WhatsApp/Newsletter/Contact/AI Hub). None of these are in the explicit permission-mapping list this phase specified, and none are reachable by the one staff role that exists today (MARKET_MANAGER doesn't hold any permission that would plausibly gate them) — left as-is rather than inventing gates not requested, matching the established "incremental rollout" pattern from ADMIN-2A.

---

## 5. Navigation changes

`admin-dashboard/components/layout/Sidebar.tsx`:
- `NavItem` gained two fields beyond the pre-existing `permission?: string`: `permissions?: string[]` (OR-matched — used for Analytics, since MARKET_MANAGER holds `analytics.view_market` while ADMIN/OWNER hold `analytics.view`/`analytics.view_global`) and `requiresLegacyAdmin?: boolean` (used only for Customers — see §9).
- **Analytics ended up gated by `analytics.view` alone, not an OR of `view`/`view_market`.** Reasoning: `/dashboard/analytics` is the *global* analytics page (calls the legacy-admin-only global endpoints) — a MARKET_MANAGER's `analytics.view_market` does not unlock it; their market data lives in the Command Center's Market Overview panel instead, a different page. Gating the sidebar link with the OR would have shown MARKET_MANAGER a link that leads to a page which then fails to load any of their data.
- Parents whose children need *different* permissions (Products, Sales) are deliberately left **ungated at the parent level** — `filterNavByPermission` drops a parent (and everything under it) before recursing into children if the parent's own `permission` check fails, which would have hidden e.g. the Suppliers link from a caller who has `suppliers.view` but not `catalog.view`.
- `StaffAccessContext` gained `hasAnyPermission(permissions[])` to support the OR case.
- Fixed a latent loading-state leak: the "while `/staff/me` is resolving, show only ungated items" fallback previously only filtered the *top-level* array, not children — since several parents are now intentionally ungated with gated children, that would have briefly flashed e.g. the Customers link during the loading window. Replaced with a recursive `stripGatedItems()`.

---

## 6. Direct-route protection

New reusable component: `admin-dashboard/components/auth/RequirePagePermission.tsx` — wraps a page's content; shows a spinner while `/staff/me` resolves, then either renders the children or toasts + redirects to `/dashboard`. Distinct from the pre-existing `PermissionGate` (which hides a *piece* of a page in place, used by Organization → Staff) — this one protects an entire route from direct navigation/bookmark/typed-URL access, which sidebar hiding never does.

Applied via the "rename original component to `XPageContent`, wrap it in a new default export" pattern (zero changes to each page's internal logic) to: `/dashboard/settings`, `/dashboard/admins` (`legacyOnly`), `/dashboard/shipping`, `/dashboard/customers` (`customers.view` + `legacyOnly`), `/dashboard/orders`, `/suppliers`, `/dashboard/analytics`, `/dashboard/coupons`.

**As always: this is a UX/defense-in-depth layer, not the security boundary.** Every one of these pages' actual data comes from an API route independently gated by `requirePermissionOrLegacyRole`/`requirePermission` server-side — a page guard bypass (or a raw `curl` to the API) still hits the real enforcement.

---

## 7. Role-aware Command Center

`admin-dashboard/app/(dashboard)/command-center/page.tsx` now branches on the caller's permissions:

- **MARKET_MANAGER (or any market-scoped role holding `analytics.view_market` but not the global `analytics.view_global`)** gets `MarketOverviewSection`: revenue/orders/visitors/supplier-count from `GET /analytics/market-overview` (server-side scoped, §1). Alerts and Support are rendered as an **honest `EmptyState`** explaining why ("no market/country dimension in the schema"), not a global count relabeled as market data.
- **OWNER/SUPER_ADMIN and legacy admin/super_admin** get the pre-existing `GlobalOverviewSection` (`useRealtimeMetrics`, unchanged content, just relocated into its own function).
- "Recent activity" (not yet built for anyone, pre-existing `EmptyState`) is shared, since it isn't scope-sensitive.

---

## 8. Security integration test matrix

All of the following are real, passing automated tests (not manual claims) — see file list below. Full backend suite: **20 test suites, 121 tests, all passing** (`npx jest` in `tech-tools-api`), plus **21 tests passing** in the web store's new `vitest` suite (localization, unrelated to this workstream).

| # | Scenario | Result | Test |
|---|---|---|---|
| 1 | MARKET_MANAGER `['CM']` → CM order by ID | 200 | `order.controller.staffScope.test.ts` |
| 2 | MARKET_MANAGER `['CM']` → IT order by ID | 404 + audited | `order.controller.staffScope.test.ts` |
| 3 | MARKET_MANAGER `['CM']` → order stored as full name "Italy" | 404 (format-agnostic match) | `order.controller.staffScope.test.ts` |
| 4 | Legacy admin → any order regardless of country | 200 | `order.controller.staffScope.test.ts` |
| 5 | MARKET_MANAGER `['CM']` list query | scope clause + expanded params present | `order.controller.staffScope.test.ts` |
| 6 | Legacy admin list query | no scope clause at all | `order.controller.staffScope.test.ts` |
| 7 | MARKET_MANAGER → in-scope order, non-refund status update | allowed | `order.controller.staffScope.test.ts` |
| 8 | MARKET_MANAGER → in-scope order, `status=refunded` | 403 (orders.refund not held) | `order.controller.staffScope.test.ts` |
| 9 | MARKET_MANAGER → out-of-scope order status update | 404 before any UPDATE runs | `order.controller.staffScope.test.ts` |
| 10 | Bulk status update, mixed in/out-of-scope IDs | only in-scope IDs updated; rest audited | `order.controller.staffScope.test.ts` |
| 11 | Bulk `status=refunded` from MARKET_MANAGER | 403, zero queries run | `order.controller.staffScope.test.ts` |
| 12 | MARKET_MANAGER `['CM']` → CM supplier | allowed | `supplier.controller.staffScope.test.ts` |
| 13 | MARKET_MANAGER `['CM']` → DE supplier | 404 + audited | `supplier.controller.staffScope.test.ts` |
| 14 | Legacy admin → any supplier | allowed | `supplier.controller.staffScope.test.ts` |
| 15 | Update/delete/list-products on out-of-scope supplier | 404, no mutation runs | `supplier.controller.staffScope.test.ts` |
| 16 | MARKET_MANAGER → global customer directory route gate | 403 | `admin-2a5-scope-matrix.test.ts` |
| 17 | MARKET_MANAGER → settings route gate | 403 | `admin-2a5-scope-matrix.test.ts` |
| 18 | MARKET_MANAGER → `staff.view` | 403 (no staff.* permission) | `admin-2a5-scope-matrix.test.ts` |
| 19 | MARKET_MANAGER → `analytics.view_global` | 403 | `admin-2a5-scope-matrix.test.ts` |
| 20 | MARKET_MANAGER → `analytics.view_market` | allowed | `admin-2a5-scope-matrix.test.ts` |
| 21 | CM market-overview aggregate | scoped SQL (`country_code = ANY`, `LOWER(shipping_address...)`) | `analytics.marketOverview.test.ts` |
| 22 | `market_scope = []` (explicitly empty) | 0 rows / `AND 1=0`, zero DB calls where checked in advance | `staff.test.ts`, `analytics.marketOverview.test.ts` |
| 23 | `market_scope = NULL` on one membership | global, unfiltered (only where role legitimately holds a global permission) | `staff.test.ts`, `analytics.marketOverview.test.ts` |
| 24 | SUSPENDED membership | denied (excluded by the `WHERE status='ACTIVE'` query — indistinguishable from no membership) | `staff.test.ts`, `admin-2a5-scope-matrix.test.ts` |
| 25 | REVOKED membership | denied, same mechanism as SUSPENDED | `admin-2a5-scope-matrix.test.ts` |
| 26 | Legacy super_admin | unchanged — bypasses staff check entirely, zero DB calls | `staff.test.ts`, `admin-2a5-scope-matrix.test.ts` |

(US-order-denied and payment-settings-denied from the original spec's matrix are covered by the same mechanisms as rows 2/17 respectively — not separately enumerated as distinct test cases since they exercise identical code paths with different literal country/route values.)

---

## 9. Known unscopeable / deliberately limited data

- **Customers.** The global customer directory (`admin/customers.routes.ts`) is **unchanged — still `authorize('admin','super_admin')` only.** `customers.view`/`customers.manage` exist in MARKET_MANAGER's permission set (for the order-linked customer data already embedded in scoped order responses — `customer_email`/`customer_name`/`customer_phone` joined in `order.controller.ts`, which inherits the same market-scope filtering as the order itself), but the `users`/customer table has no country column of its own to scope a *directory* by. Sidebar link and page guard both additionally require `legacyOnly` so a MARKET_MANAGER never sees a link that would 403 anyway. `customers.view_pii` is not granted to MARKET_MANAGER at all (not in the role's permission set).
- **Inventory.** There is **no dedicated inventory admin endpoint in the current API surface at all** (confirmed via search — `inventory` only appears inline inside `order.controller.ts`/`product.controller.ts`/`supplier-import.controller.ts`, never as its own list/detail route). `inventory.view` is in MARKET_MANAGER's permission matrix but is currently a no-op — nothing checks it. Building a country-scoped inventory endpoint was explicitly out of scope ("do not pretend inventory is country-scoped... stay conservative") and the schema genuinely has no fulfilment-location/country ownership to scope by yet (pending Global Commerce). No code was added here; this is a documented pre-existing gap, not a regression.
- **Support.** `email_messages`/`contact_analytics` (the actual support/contact schema) have **no market or country field** — confirmed by inspection. `support.view`/`support.manage` are granted to MARKET_MANAGER in the permission matrix, but `contact.routes.ts` is unchanged (still `authorize('admin','super_admin')` only), so this is effectively **BLOCKED**, not silently made global. The Command Center's Market Overview panel shows an explicit `EmptyState` naming this rather than omitting the panel silently.
- **Product-economics/auto-pause endpoints** (under `/suppliers/products/:id/economics`, `/auto-pause/evaluate`, `/ops/auto-paused`) were **not** extended to staff permissions. Products have no country dimension either; gating these under `suppliers.manage` (a market-scoped permission) would have granted a MARKET_MANAGER *global* product-economics access under a label that implies market-limited access — left legacy-admin-only instead.

---

## 10. Security findings (this phase)

1. **`orders.refund` gap** (self-identified, fixed) — see §2. Without the explicit check, `orders.manage` alone would have implicitly permitted MARKET_MANAGER to mark orders refunded.
2. **List-filtering-only would have been an IDOR** if shipped without the `:id`-route guards — every `assert*InScope` helper exists specifically because a scoped caller who already has/guesses a UUID must not bypass the list filter. Caught during design, not after the fact.
3. **Empty vs. NULL `market_scope`** — re-confirmed still correct this phase (was a self-caught bug in the prior ADMIN-2A phase); extended the same fail-closed rule to the new `getMarketOverview` endpoint and covered it with a dedicated test (row 22 above).
4. **Unrelated production bug found and fixed during this phase's Command Center work:** `getConversionRate()` in `tech-tools-api/src/workers/metrics.broadcaster.ts` compared a Postgres `COUNT()` result (a bigint **string**, e.g. `"0"`) against the number `0` with `===`, which never matched. With zero viewers in the trailing 24h window this fell through to `0/0 = NaN`, which `JSON.stringify` silently turns into `null` over the `metrics-update` websocket payload — crashing the live Command Center on `metrics.conversionRate.toFixed(2)` (`Cannot read properties of null`) until a page refresh happened to land on a moment with a non-zero count. Fixed by coercing to `Number(...)` before comparing, plus a defensive frontend guard; both covered by new tests (`metrics.broadcaster.test.ts`). Committed separately (`9caf802`) since it's a live-production defect unrelated to the staff-scoping feature work.

No other cross-market data leakage was found. No new dependency or infrastructure risk was introduced.

---

## 11. Browser fixture walkthrough (test account — not a real employee)

**Do not perform this against a real employee's account.** Use a throwaway customer account created solely for this test, e.g. `qa-market-manager-cm+test@<yourdomain>`.

### Setup

1. **Create the customer account** through the real signup flow (storefront `/register` or `POST /api/v1/auth/register`) — this keeps password hashing/validation/everything else exactly as a real account would go through it. `user_type` stays `customer`; nothing here touches it.
2. **Find the new user's ID** (read-only):
   ```sql
   SELECT id, email, user_type FROM users WHERE email = 'qa-market-manager-cm+test@yourdomain.com';
   ```
3. **Grant the test MARKET_MANAGER membership**, either through the admin dashboard's Organization → Staff → "Grant" form (as the founder's own super_admin account — this is the real product surface, exercising `POST /staff`) or directly:
   ```sql
   INSERT INTO staff_memberships (user_id, role, market_scope, status, granted_by)
   VALUES ('<USER_ID>', 'MARKET_MANAGER', ARRAY['CM'], 'ACTIVE', '<FOUNDER_USER_ID>');
   ```

### Walkthrough matrix

| Actor | Expected after login |
|---|---|
| **ACTIVE MARKET_MANAGER `['CM']`** | `GET /staff/me` returns the membership; dashboard access cookie set; sidebar shows Orders/Suppliers/Analytics/Marketing (not Customers/Settings/Staff/Admins); Command Center shows Market Overview, not global Business Pulse; opening a CM order works, an IT/US order 404s; opening `/dashboard/settings` directly redirects to `/dashboard` with a toast. |
| **SUSPENDED** (`POST /staff/:id/suspend` or `UPDATE staff_memberships SET status='SUSPENDED', suspended_at=now(), suspended_by='<FOUNDER_ID>' WHERE id='<MEMBERSHIP_ID>'`) | `GET /staff/me` returns no memberships (query filters `status='ACTIVE'`); dashboard access denied entirely — same as a plain customer. |
| **REVOKED** (`POST /staff/:id/revoke` or the equivalent `UPDATE ... status='REVOKED'`) | Same as SUSPENDED — denied entirely. Also: the `(user_id, role)` slot is now free for a fresh grant, unlike a plain unique constraint would allow. |
| **Plain customer** (no membership ever granted) | Normal storefront access; `/admin/*` and `/dashboard/*` staff routes all 403/redirect. |
| **Legacy `admin`** | Unchanged from before this phase — full access to everything `authorize('admin','super_admin')` already covered, `requirePermissionOrLegacyRole` short-circuits before ever touching `staff_memberships`. |
| **Legacy `super_admin`** | Same as `admin`, plus staff-management routes (`staff.grant`/`staff.revoke`) which are `super_admin`-only even among legacy roles. |

### Cleanup / exact revoke procedure

```sql
-- Preferred: through the UI (Organization -> Staff -> select the test user -> Revoke),
-- which calls POST /staff/:id/revoke and writes a staff_audit_log entry automatically.

-- Equivalent direct SQL if needed:
UPDATE staff_memberships
SET status = 'REVOKED', revoked_at = now(), revoked_by = '<FOUNDER_USER_ID>'
WHERE user_id = '<TEST_USER_ID>' AND role = 'MARKET_MANAGER' AND status IN ('ACTIVE','SUSPENDED');
```

**Do not `DELETE` the `staff_memberships` row** — `REVOKED` is the correct terminal state (matches the partial-unique-index design, which frees the role slot without losing history) and `staff_audit_log` entries reference the membership. If the test customer account itself should not remain afterward (no real order history attached to it), it can be deactivated the same way any other test customer account would be — no staff-specific step needed for that part.

---

## 12. First real MARKET_MANAGER onboarding checklist (for the founder to execute later — not performed this phase)

1. Confirm the employee's real user account already exists (`user_type = customer`, they've logged into the storefront/dashboard at least once) — or have them create one first. Their `users.user_type` is never changed.
2. Decide their `market_scope` explicitly — a real ISO alpha-2 array, e.g. `['CM']`. Do not leave it `NULL` (global) unless that is genuinely intended.
3. Grant via the admin dashboard: Organization → Staff → Grant → role `MARKET_MANAGER`, paste their user ID, set market scope, submit. This calls `POST /staff` (`staff.grant`, super_admin-only today).
4. Have them log out and back in (or just refresh) so `GET /staff/me` picks up the new membership; verify the Command Center shows Market Overview and the sidebar reflects the permission set in §4.
5. Spot-check with them: open one real in-scope order, confirm an out-of-scope order/supplier ID (if they have one to hand) 404s, confirm Settings/Staff/Admins/global Customers are unreachable.
6. Brief them on what they explicitly do **not** have: refunds, global cancellation beyond `orders.manage`, financial/payment settings, the global customer directory, the global analytics page (they get Market Overview instead).
7. If anything needs correcting later, use Suspend (temporary) or Revoke (permanent) from the same Staff screen — never edit `staff_memberships` directly in production outside an emergency.

---

## STAFF: READY FOR FIRST STAFF PILOT

All explicit requirements for this workstream are implemented, tested (26 integration-test scenarios, 121 passing backend tests total), and documented: real login-to-dashboard flow, market scope wired into orders/suppliers/analytics at the query layer with IDOR guards on every `:id` route, permission-aware navigation and page-level route guards, a role-aware Command Center, and an honest accounting of what remains unscopeable (customers directory, inventory, support) rather than a silent global fallback. No real employee was onboarded — that step is documented as a checklist for the founder to execute when ready.
