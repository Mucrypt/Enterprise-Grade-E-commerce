# Phase MARKET-OPS-0: Read-Only Architecture Audit — Staff Access for a Remote Cameroon Market & Operations Manager

**Date:** 2026-08-08
**Scope:** Read-only audit. No code changes, no migrations run, no destructive actions. This document is the deliverable.
**Goal being designed for:** let the founder add a remote Cameroon Market & Operations Manager who keeps a normal customer account and separately receives scoped staff privileges — without touching `users.user_type` and without granting blanket admin power.

This audit re-verified everything against the current source tree (not against `docs/PRODUCTION-READINESS-AUDIT.md`, which is dated 2026-08-01 and is treated here as a lead, not a source of truth — where the two overlap, this document's findings are the fresher ones and both agree).

---

## 1. Current Authentication & Authorization Flow

### 1.1 tech-tools-api (source of truth for all enforcement)

- Auth: `POST /auth/login` / `POST /auth/register` (`tech-tools-api/src/api/v1/auth/auth.controller.ts`) issue a JWT access token + refresh token. Refresh via `middleware/auth.ts`.
- Every protected route uses two middlewares from `tech-tools-api/src/middleware/auth.ts`:
  - `authenticate` — verifies the JWT, attaches `req.user` (`userId`, `userType`).
  - `authorize(...roles)` (lines 95-113) — `if (!allowedRoles.includes(req.user.userType)) return res.status(403)`. **This is the entire authorization model in production today: a coarse string match against `user_type`.**
- Admin sub-routers apply this consistently at the router level: `admin.routes.ts:28` (`authorize('super_admin')`), `sellers.routes.ts:26`, `customers.routes.ts:14`, `books.routes.ts:29` (`authorize('admin','super_admin')`), `order.routes.ts:38-54` (per-route `authorize('admin','super_admin')`). No route was found missing this middleware.
- **There is no per-permission enforcement anywhere in the codebase.** `admin_permissions` / `admin_role_permissions` (see §2.2) are read-only display data — no `checkPermission`/`requirePermission`/bitmask lookup exists (`grep` for those patterns returns nothing). Practically: **an `admin` can hit every route gated to `admin`, full stop** — there is no way today to give someone "admin, but only orders" or "admin, but only Cameroon."

### 1.2 admin-dashboard (Next.js)

- **No `middleware.ts` exists anywhere in `admin-dashboard`** — there is no edge/server-side route guard on the Next.js app itself.
- `admin-dashboard/app/(dashboard)/layout.tsx:16-21` only checks that *a* token exists in `localStorage`; it does not check `userType`.
- `admin-dashboard/contexts/AuthContext.tsx:76-84` checks `userType !== 'admin' && userType !== 'super_admin'`, but only inside `login()` — i.e. only as a UX gate on the dashboard's own login form, not a persistent guard on every navigation.
- **Consequence:** since the dashboard and API share the same JWT format/secret, a plain customer's own valid access token would pass `layout.tsx`'s check and render the admin shell before any individual API call 403s. This has presumably never mattered because no non-admin has had a reason to load the dashboard — but it is exactly the scenario a customer-who-is-also-staff account creates, and it is currently unguarded.

### 1.3 e-commerce-web-store / tech-tools-mobile-app

- Both are customer-facing only. The mobile app (`tech-tools-mobile-app/src/api/index.ts`) has no admin code paths at all (`grep` for `super_admin|isAdmin` in `src` returns nothing) — tokens are stored via `expo-secure-store`, not `AsyncStorage`.
- Neither app is a channel a market manager would use for staff work today; the admin-dashboard is the only relevant surface.

---

## 2. `users.user_type`, `admin_permissions`, `admin_role_permissions`, admin invitations — exact behaviour

### 2.1 `users.user_type`

- Defined `tech-tools-api/src/database/migrations/001_initial_schema.sql:12`: `user_type VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (user_type IN ('customer', 'supplier', 'admin', 'super_admin'))`.
- A **second**, stricter CHECK is added later: `002_admin_management_schema.sql:158-159`: `ALTER TABLE users ADD CONSTRAINT check_user_type_valid CHECK (user_type IN ('customer', 'admin', 'super_admin'))`. Postgres enforces both simultaneously, so the effective allowed set is the intersection — `'supplier'` is a schema inconsistency (allowed by the original constraint, silently blocked by the later one).
- **There is no separate `admins` table.** Admin-ness is purely this one column on `users`. This is the crux of why direct promotion is unsafe (see §3).

### 2.2 `admin_permissions` / `admin_role_permissions`

- `002_admin_management_schema.sql`: `admin_permissions` (line 24, permission catalog) and `admin_role_permissions` (line 35, many-to-many keyed on a `role` string), seeded with rows mapping e.g. `admin` vs `super_admin` to different permission sets (lines 94-151).
- Used in exactly two places, both **read-only display**: `admin.controller.ts:341-345` (`getAdminById`) and `:625-633` (`getAdminPermissions`) — both just `SELECT` and return what a role *could* do.
- **No request in the codebase is gated by these tables.** They are decorative. The seed data withholds e.g. `manage_admins`/`manage_settings` from the `admin` role in principle, but nothing server-side enforces that distinction beyond the separate `super_admin`-only routes in `admin.routes.ts`.
- **Implication for this design:** don't repeat this mistake. If we ship a permissions table again without wiring enforcement to it, we'll have built a second decorative system.

### 2.3 Admin invitations

- Table `admin_invitations` (`002_admin_management_schema.sql:45-55`): token, role, `expires_at`, `is_used`.
- `inviteAdmin` (`admin.controller.ts:24-130`) — requires caller to be `super_admin` (checked in code at lines 35-38, in addition to the route middleware). `acceptInvitation` (`:132-220+`) validates token/expiry/`is_used`, hashes a password, and **inserts a new row into `users` with `user_type = invitation.role`**.
- Routes: `POST /admin/invite` (super_admin only, `admin.routes.ts:31`), public `POST /admin/invitations/accept` (`admin.routes.ts:22`, intentionally unauthenticated — it's the acceptance step).
- **This flow always creates a brand-new user row.** There is no existing mechanism to invite an *existing* user (e.g. an existing customer) into a staff role — accepting an invitation today always means "sign up as a new admin account," which is the opposite of what the founder wants (same customer account, added staff access).

---

## 3. Why promoting an existing customer directly to admin is unsafe and restrictive

Given §1–2, flipping an existing customer's `users.user_type` to `'admin'` would mean:

1. **All-or-nothing power, day one.** `authorize()` only checks the role string — the moment `user_type = 'admin'`, that account can hit *every* route gated to `admin`: full supplier CRUD, full seller moderation, all customers' order/PII data, refund-adjacent order endpoints, etc. There is no working mechanism to scope them to "just Cameroon orders and catalog" — the permission tables that would in theory allow this are unenforced (§2.2).
2. **No market/region concept exists anywhere in the schema.** Nothing filters admin data access by country. A Cameroon-only manager promoted this way would, by construction, also see and be able to edit EU/global orders, suppliers, and customer data.
3. **It's a single lossy column, not an additive grant.** `user_type` has one value; the two competing CHECK constraints already show this column doesn't cleanly support anything beyond `customer | admin | super_admin`. There's no reversible "customer + staff" state, no audit trail of *when/why* someone became staff (`admin_invitations` only captures the invite step, not ongoing status), and no clean way to revoke staff access back to "just a customer" — you'd be relying on flipping the same single column back, with no record of what was granted or when.
4. **The dashboard-shell gap (§1.2) makes it worse, not better.** Because `admin-dashboard` has no server-side role guard, granting `admin` doesn't just unlock API routes — it unlocks the entire dashboard shell rendering client-side before any per-call 403 kicks in, for a person who is, by the founder's own framing, meant to be scoped and remote.
5. **No JWT secret hygiene to lean on either.** §12 below documents inconsistent hardcoded JWT fallback secrets across the codebase — before granting *any* new privileged account, that needs to be confirmed sound in production, because a promoted admin account's blast radius is total.

In short: today's model has exactly two admin tiers (`admin`, `super_admin`), both unscoped and both effectively "can do anything an admin can do." There is no path from "trusted customer" to "scoped operational staff" that doesn't currently mean "give them the keys to everything."

---

## 4. Proposed additive `staff_memberships` architecture

Design goal: a user keeps `users.user_type = 'customer'` (or whatever it already is) forever. Staff-ness is a **separate, additive grant**, not a mutation of the existing identity column. `authorize()` keeps working unmodified for existing `admin`/`super_admin` accounts — this is purely additive, nothing existing is renamed or removed.

```sql
-- New role vocabulary, independent of users.user_type
CREATE TYPE staff_role AS ENUM (
    'OWNER',
    'SUPER_ADMIN',
    'ADMIN',
    'MARKET_MANAGER',
    'CATALOG_MANAGER',
    'ORDER_MANAGER',
    'MARKETING_MANAGER',
    'SUPPORT_AGENT'
);

CREATE TABLE staff_memberships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_role      staff_role NOT NULL,
    market_scope    TEXT[] NULL,          -- NULL/empty = global; else ISO country codes e.g. ARRAY['CM']
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','revoked')),
    invited_by      UUID REFERENCES users(id),
    invited_at      TIMESTAMPTZ,
    activated_at    TIMESTAMPTZ,
    suspended_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, staff_role)
);
CREATE INDEX idx_staff_memberships_user_id ON staff_memberships(user_id) WHERE status = 'active';

CREATE TABLE staff_audit_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_membership_id UUID REFERENCES staff_memberships(id) ON DELETE SET NULL,
    action              VARCHAR(50) NOT NULL,   -- granted, revoked, suspended, reactivated, role_changed, scope_changed, staff_login
    performed_by        UUID REFERENCES users(id),
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Key properties:
- **Additive, reversible.** A grant is a row; revocation is `status = 'revoked'`, not a column mutation on `users`. A user can lose all staff rows and instantly return to being a plain customer with zero residual admin capability — nothing to "undo" on the `users` row itself.
- **A user can hold multiple staff roles** (e.g. `MARKET_MANAGER` + `SUPPORT_AGENT`) via multiple rows; effective permissions are the union. `UNIQUE(user_id, staff_role)` prevents duplicate identical grants, not multiple different ones.
- **`market_scope` lives on the grant, not on the user.** The same person could in theory hold a global `SUPPORT_AGENT` grant and a CM-scoped `MARKET_MANAGER` grant.
- **Auth middleware change is additive, not a rewrite:** a new `requireStaff(...staffRoles)` middleware checks `staff_memberships` for the authenticated `req.user.userId`, the same way `authorize()` checks `req.user.userType` today. Existing `authorize('admin','super_admin')` routes are untouched; new market-ops routes/UI use `requireStaff(...)` instead (or a hybrid `authorize('admin','super_admin') OR requireStaff('ADMIN','SUPER_ADMIN','OWNER')` if you want `OWNER`/legacy `super_admin` to be fully interchangeable — a decision for the founder, not assumed here).
- **Permissions matrix (§5) is enforced in code**, not seeded into an unenforced DB table — deliberately avoiding the mistake found in §2.2. A single TypeScript module (e.g. `staffPermissions.ts`) maps `staff_role → Set<Permission>`, and `requirePermission(permission)` middleware checks it against the union of the caller's active `staff_memberships`. This can be mirrored into a DB table later for admin-UI editability, but only after the code-level enforcement path is proven — not seeded speculatively again.
- **`admin-dashboard` gap (§1.2) must be closed as part of this**, not left as-is: a real `middleware.ts` (or equivalent server check) that decodes the JWT and requires either legacy `userType ∈ {admin,super_admin}` or an active `staff_memberships` row before rendering the `(dashboard)` shell at all — otherwise a CM manager's own customer session could still render the admin shell client-side even with a correctly scoped API.

---

## 5. Permissions matrix

Resource-action grants per role. "Own market" = filtered by the grant's `market_scope`; "Global" = unrestricted; "—" = no access. `OWNER` and `SUPER_ADMIN` are always global regardless of any `market_scope` value set on their row (scoping a super-tier role would be a footgun, not a feature).

| Resource / Action | OWNER | SUPER_ADMIN | ADMIN | MARKET_MANAGER | CATALOG_MANAGER | ORDER_MANAGER | MARKETING_MANAGER | SUPPORT_AGENT |
|---|---|---|---|---|---|---|---|---|
| Orders — view | Global | Global | Global | Own market | Own market (read-only) | Own market | — | Own market (read-only) |
| Orders — edit/fulfill status | Global | Global | Global | Own market | — | Own market | — | — |
| Orders — refund/cancel | Global | Global | Global | Own market (capped $ — TBD) | — | Own market (capped $ — TBD) | — | Escalate only |
| Products/Catalog — view | Global | Global | Global | Own market | Global or own market (TBD, see §6) | Own market (read-only) | Global (read-only) | Own market (read-only) |
| Products/Catalog — edit/publish | Global | Global | Global | Own market | Global or own market (TBD) | — | — | — |
| Inventory — view | Global | Global | Global | Own market | Own market | Own market (read-only) | — | — |
| Inventory — adjust | Global | Global | Global | Own market | Own market | — | — | — |
| Suppliers — view | Global | Global | Global | Own market (by `suppliers.country_code`) | Own market | — | — | — |
| Suppliers — manage / CSV import | Global | Global | Global | Own market | Own market | — | — | — |
| Sellers — moderate/verify | Global | Global | Global | — | — | — | — | — |
| Marketing/content/coupons | Global | Global | Global | Own market (view) | — | — | Own market or global (TBD) | — |
| Customer PII — view | Global | Global | Global | Own market (order-linked only) | — | Own market (order-linked only) | — | Own market (order-linked only) |
| Staff management (invite/revoke/role-change) | Yes | Yes (below OWNER) | — | — | — | — | — | — |
| Settings / financial / API keys / Stripe config | Yes | — | — | — | — | — | — | — |
| Analytics | Global | Global | Global | Own market | — | Own market (order stats) | Own market/global (TBD) | — |

Notes:
- Cells marked **TBD** are founder decisions this audit surfaces rather than assumes (e.g. refund dollar caps, whether a Catalog Manager should be able to edit globally-shared catalog rows or only market-tagged ones — see §6's caveat that the product catalog is not currently market-taggable).
- `SUPPORT_AGENT` never sees full customer PII independent of an order context — only what's attached to orders in their scope, to limit blast radius for a support-tier account.
- No role below `SUPER_ADMIN` can invite/revoke staff. This mirrors the existing `inviteAdmin` restriction (§2.3), extended to the new roles.

---

## 6. Market scoping design

**What can actually be scoped today, based on the real schema:**

- **Orders** — `orders.shipping_address` is `JSONB NOT NULL` (`001_initial_schema.sql:216`) and includes a `country` field (mirrors the standalone `addresses.country VARCHAR(100) NOT NULL` at line 35). Market scoping for orders is straightforward: filter `WHERE shipping_address->>'country' = ANY(market_scope)` (mapping ISO codes to whatever country-name format is actually stored — needs a quick data check, since `country` here is a free-text-ish field, not necessarily an ISO code column; confirm exact stored format before implementing the filter).
- **Suppliers** — `suppliers.country_code` exists (`025_supplier_profitability_controls.sql`). Market scoping for suppliers/supplier_products/CSV import is a direct `WHERE suppliers.country_code = ANY(market_scope)` filter.
- **Products/catalog** — **no market/region tagging exists on `products` at all.** The catalog is a single global list. This is the one place market scoping cannot be cleanly implemented today without a schema addition (e.g. an optional `products.market_scope TEXT[]` or a `product_markets` join table) — out of scope to build in this read-only audit, but flagged because it directly affects the CATALOG_MANAGER row's "TBD" cells above. Two honest options for Phase 1: (a) give a CM Catalog/Market Manager global *read* access to the shared catalog but scope *write* access to nothing until product-level market tagging exists, or (b) accept that catalog is inherently global and don't attempt to scope it — only scope orders/suppliers/inventory-by-supplier. Recommend (b) for Phase 1 to avoid inventing new schema under this ticket.
- **Inventory** — no direct country field on `inventory` itself, but it's reachable transitively via `supplier_products → suppliers.country_code` for supplier-sourced stock. Direct-stocked inventory (no supplier link) has no market signal — same caveat as products.

**Enforcement mechanism:** a small `applyMarketScope(query, staffMembership, resource)` helper invoked from the relevant controllers (orders, suppliers) that, when `market_scope` is non-null, appends the appropriate `WHERE` clause. This is a query-filter concern, not a new subsystem — implemented alongside `requirePermission` middleware, not as a competing authorization layer.

**Recommendation:** ship market scoping for **orders and suppliers only** in Phase 1 (both have real country data today); treat catalog-level market scoping as a deliberately deferred follow-up requiring its own small schema decision, not bundled into this staff-access change.

---

## 7. Product/inventory architecture audit — `stock_quantity` vs `inventory`

**Two independent, unsynchronized numbers exist, and this is a live bug, not just a design smell:**

- `products.stock_quantity` was added later via `tech-tools-api/src/database/migrations/012_add_stock_quantity.sql:4` (`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0`).
- `inventory` (the real table) was defined from the start: `001_initial_schema.sql:182-195` — `current_stock`, `reserved_stock`, `available_stock` (a `GENERATED ALWAYS AS (current_stock - reserved_stock) STORED` column), `low_stock_threshold`, `warehouse_location`, per `product_id`/`variation_id`, no unique constraint (supports multi-warehouse rows).
- **No triggers, no backfill, no service-layer dual-write connects the two.** Confirmed by a developer's own comment documenting a prior incident: `order.controller.ts:1488-1494` — crediting `products.stock_quantity` instead of releasing `inventory.reserved_stock` on cancellation "silently left cancelled orders' units stuck reserved forever, permanently shrinking available_stock... with every cancellation."
- **Checkout only ever reads/writes `inventory`:** stock check is `SUM(i.available_stock)` in `validateAndPriceOrderItems` (`order.controller.ts:1008-1009`, used by all four order-creation code paths); reservation is `UPDATE inventory SET reserved_stock = reserved_stock + $1` (`order.controller.ts:1087-1093`); release on cancel is the inverse (`:1502-1506`). `products.stock_quantity` is never read by checkout at all.
- **Newly discovered live bug:** product creation (`product.controller.ts:357-396`) and the supplier CSV import commit step (`supplier-import.controller.ts:259-266`) both write `products.stock_quantity` but **never insert a matching `inventory` row**. Result: every newly created or CSV-imported product has `available_stock = 0` in `inventory` forever, and will fail checkout with "Insufficient stock" regardless of what `stock_quantity` shows in the admin UI. This is independent of the market-ops feature but directly relevant — a Cameroon Market Manager doing catalog/supplier-import work will hit this immediately.
- Two more independent stock numbers exist and are unrelated to the above: `product_variations.stock_quantity` (defined, never read/written outside its own `CREATE TABLE`) and `supplier_products.stock_quantity` (the supplier's own offered quantity — a legitimately separate concept, used correctly in `supplier.controller.ts`/`supplier-import.controller.ts`).

**Recommendation — one authoritative model:** `inventory` is already the de facto authoritative table (it's the only one checkout trusts). The fix is not "pick a winner," it's:
1. Stop treating `products.stock_quantity` as real — either drop it (schema change, out of scope for this read-only audit) or clearly mark it computed/deprecated in the admin UI.
2. Fix product-create and CSV-import-commit to always insert a matching `inventory` row atomically with the `products` insert, closing the bug above.
This matters for the staff design because `CATALOG_MANAGER`/`MARKET_MANAGER` will be doing exactly this workflow (import CM suppliers' catalogs) — worth fixing before onboarding, not after.

---

## 8. Suppliers, `supplier_products`, `product_unit_economics`, CSV import, `seller_profiles` — no duplication needed

- **`suppliers`** (`001_initial_schema.sql:143-162`, extended by `025_supplier_profitability_controls.sql` and `036_supplier_catalogue_import.sql`) = upstream B2B sourcing vendors. Has `country_code` (from 025) — this is the hook market scoping uses (§6).
- **`supplier_products`** (`001_initial_schema.sql:165-179`) = supplier↔product join with `cost_price`, `stock_quantity` (the supplier's own offer, distinct from `inventory`), `min_order_quantity`, `currency_code` (defaults to `'EUR'` per `036`).
- **`product_unit_economics`** (`025_supplier_profitability_controls.sql:26-37`) = per-product margin/cost tracking (`landed_cost`, `gross_margin`, `contribution_margin`), separate table from `supplier_products.cost_price`.
- **CSV import** = `POST /suppliers/:id/import/preview` + `POST /suppliers/:id/import/:batchId/commit` (`supplier.routes.ts:35-36`, implemented in `supplier-import.controller.ts` using `multer` + `csv-parse/sync`), writing to `supplier_import_batches` (`036_supplier_catalogue_import.sql`).
- **`seller_profiles`** (`034_seller_tiers_verification.sql`) = a **completely separate** marketplace-seller/creator-tier system (`unverified/basic/trusted/pro` tiers, its own commission table `seller_tier_config` at 20/15/12/10%), linked to `products` via `products.seller_profile_id`, with **zero FK or code relationship to `suppliers`**.

**Conclusion for this design:** suppliers = where the business sources CM inventory from; sellers = an unrelated marketplace-listing concept. The Cameroon Market Manager's job (per the founder's brief) maps to **suppliers + orders + inventory**, not to `seller_profiles` — nothing here needs to be built from scratch, and nothing should be merged or duplicated. Reuse existing tables; the only addition is the `market_scope` filter described in §6.

---

## 9. Internationalization audit — this directly blocks a Cameroon rollout today, independent of staff access

- **Currency is hardcoded to `'EUR'`** in the real checkout path (`order.controller.ts:1148,1180,1214`, and guest-order equivalents at 1308/1351/1386), justified by an explicit migration comment: `038_checkout_payment_safety.sql:6-9` — *"This is an Italy-based business: new orders should default to EUR, not USD."* A separate, inconsistent legacy `payment.controller.ts:56` endpoint still defaults to `'usd'` from client input — an existing bug, not something new introduced by this audit.
- **Tax is a flat, non-configurable 8%** (`order.controller.ts:1051-1052`: `const taxRate = 0.08 // 8% tax - can be configurable` — the comment is aspirational; nothing reads country/state to vary it). A `taxRate` column exists per-product (`product.controller.ts:308`) but is **never used** in the actual order-total calculation.
- **Shipping is a flat US-shaped rule** (`order.controller.ts:1053`: free ≥ $50, else $5.99), with no per-country logic. A real multi-carrier rate engine exists (`services/shipping/{fedex,ups,dhl}.ts`) but checkout never calls it — it's wired only into a separate `/shipping` rate-lookup endpoint.
- **`postal_code` is unconditionally `NOT NULL`/required**, both DB-level (`001_initial_schema.sql:36`) and in every checkout form (web `CheckoutPage.tsx:213`, mobile `checkout.tsx:240`) — Cameroon addresses, which typically have no postal code, would be **rejected by checkout as it exists today**. Notably, the mobile app already passes `postalCodeEnabled={false}` to an address-autocomplete widget (`checkout.tsx:647`) without relaxing the required-field validation — a half-finished acknowledgment of this exact problem.
- **No mobile money / Orange Money / MTN MoMo integration** — the dominant payment rail in Cameroon is entirely absent; Stripe is the only real payment integration (PayPal appears only as marketing copy, never as code).
- **No i18n/locale framework** anywhere in any of the three frontends (`grep` of all three `package.json` files for i18n/intl/locale packages returns zero matches) — all UI text is hardcoded English.

**Implication:** none of this is caused by or fixed by the staff-access design in this document. But it means a Cameroon Market Manager, once granted access, would be managing orders/customers in a system that cannot currently take a Cameroonian customer's address through checkout, taxes everyone at a flat Italy-shaped 8%, and has no local payment rail. Recommend surfacing this to the founder as a **separate, higher-priority track** from the staff-access work — the manager can administer existing (EU-sourced) data on day one, but the business cannot yet actually sell *to* Cameroon.

---

## 10. Staging/test readiness

- **Mobile app hardcodes the production API URL as a literal constant:** `tech-tools-mobile-app/src/api/index.ts:37` — `const API_BASE_URL = 'https://techtoolstore.com/api/v1'`, not read from any env var. Same pattern for images: `src/utils/index.ts:8`. No `.env`/`.env.example`/`app.config.js` exists in the mobile app at all — only a static `app.json`. `eas.json`'s `development`/`preview`/`production` build profiles only vary the Stripe *publishable* key, never the API URL — **every mobile build, including local dev builds, talks to the live production API today.** One dead code path checks `EXPO_PUBLIC_API_URL` (`event-tracking.ts:32`) with a comment already admitting "this is never actually set anywhere in this app."
- **Only two environment tiers exist repo-wide: `development` and `production`.** Confirmed by a repo-wide `grep -rli staging` across all `.yml/.yaml/.conf/.env*` files returning zero matches — no staging docker-compose, nginx config, or env file exists anywhere.
- **Docker topology** (`infrastructure/docker-compose.prod.yml`): postgres, redis, api, admin-dashboard, web-store, nginx (self-signed cert fallback if no Let's Encrypt cert is present), pgadmin (bound to `127.0.0.1` only), certbot auto-renew. Notably the migrations directory is *also* mounted as Postgres's own `docker-entrypoint-initdb.d` (see §11) — a second, independent migration-application path that only fires on a fresh empty volume.

**Recommendation:** before onboarding a remote staff account at all, stand up a real `staging` tier — a third `NODE_ENV`, a `docker-compose.staging.yml` pointed at a non-production database, and (critically) fix the mobile/API URL to be env-driven so a "development" or "staging" build doesn't quietly hit prod. This is foundational for testing the new staff-access system safely (§16) — you cannot dry-run granting a remote manager privileges against production data with the current setup.

---

## 11. Shipping adapter status — confirmed mock-fallback risk

- `services/shipping/carriers/{fedex,ups,dhl}.ts` each wrap real carrier HTTP APIs but silently fall back to hardcoded mock rates in **two** ungated conditions:
  1. No credentials configured: e.g. `fedex.ts:145-148` — `// If no credentials, return mock rates` / `if (!this.apiKey) { return this.getMockRates(...) }`. Same in `ups.ts` and `dhl.ts`.
  2. **Any** error from the real API call — network failure, auth failure, rate limiting, malformed response — falls through to the same mock path: `fedex.ts:218-221` (`catch (error) { logger.error(...); return this.getMockRates(...) }`), mirrored in `ups.ts`/`dhl.ts`. Mock label data is literally the string `'MOCK_LABEL_DATA_BASE64'`.
- Neither fallback is gated by `NODE_ENV` or a feature flag — it is unconditional in every environment, including production.
- `ShippingService.initialize()` loads carrier credentials from a `shipping_carriers` DB table, but is **only invoked from an admin "update carrier" action** — never at server bootstrap (`src/index.ts`/`src/app.ts` have no reference to it). So on any fresh deploy, or whenever the DB carrier row is missing/inactive, real credentials never load, and a rate request from checkout or the admin UI silently returns fabricated prices with only a `logger.error` line — no customer-facing error, no admin alert.

**This is a standing production risk independent of the staff-access feature**, but directly relevant to a Cameroon Market Manager who would be relying on real shipping quotes for CM orders. Per the task's explicit constraint — *production must never silently return mock carrier rates* — recommend this be fixed (fail loudly / surface a clear "shipping rates unavailable" state) before any market-ops role is given fulfillment responsibility that depends on it.

---

## 12. Migration safety — `026_unified_analytics_schema.sql` and the `admins(id)` reference

- `tech-tools-api/src/database/migrations/026_unified_analytics_schema.sql:149`, inside the `alerts` table: `acknowledged_by UUID REFERENCES admins(id) ON DELETE SET NULL`.
- **No migration in the repo has ever created an `admins` table.** `grep -rn "\badmins\b"` across all 39 migration files matches only this one FK, plus unrelated permission-name strings (`'manage_admins'` etc. in `002`) and comments. Per §2.1, admin-ness lives entirely on `users.user_type`, and `002`'s own admin tables correctly reference `users(id)` — confirming this is the codebase's real, established convention and `026` is the outlier.
- **This FK target does not exist**, so running `026` via the app's transactional migration runner (`tech-tools-api/src/database/migrate.ts` — wraps each file in `BEGIN`/execute/`COMMIT`, tracked in a `schema_migrations` table, `process.exit(1)` on failure) would fail at `CREATE TABLE` time and roll back, **blocking every migration after it (027–039) from ever being recorded as applied through that path.**
- **A second, independent migration-application path exists and can silently diverge:** `infrastructure/docker-compose.prod.yml:12` mounts the entire migrations folder as Postgres's own `docker-entrypoint-initdb.d`, which the official Postgres image auto-executes **only on first init against an empty data volume**, and which does **not** use/populate `schema_migrations` at all.
- **A third, ad hoc path exists:** `infra/scripts/migrate-admin-schema.sh` pipes `002_admin_management_schema.sql` directly into `psql` against the **dev** container, bypassing tracking entirely — evidence that manual, untracked migration application has already happened at least once in this repo's history.
- **No CI/CD applies migrations automatically** — the production Docker image's `CMD` never runs `migrate:up`; per the repo's own README, migrations are applied manually.

**Conclusion — do not touch `026` or assume a clean sequential migration history.** Before adding any new migration (e.g. `staff_memberships` from §4), the actual state of production's `schema_migrations` table must be checked first — it is entirely possible `026` was hand-patched, skipped, or never applied at all in prod, and the repo alone cannot tell us which. This is a **hard prerequisite**, called out explicitly by the task constraints ("do not alter already-applied migrations until production migration history is known").

---

## 13. Security blockers before giving a remote manager dashboard access

In priority order:

1. **Inconsistent hardcoded JWT fallback secrets.** Three different literal fallbacks exist across the codebase for when `JWT_SECRET`/`JWT_REFRESH_SECRET` is unset: `'default-secret'` / `'default-refresh-secret'` (`auth.controller.ts:94,96,228,230`; `middleware/auth.ts:155`), `'development-secret'` (`books.controller.ts:344,396`; `library.controller.ts:196,247`), and a non-null-assertion crash path elsewhere (`middleware/auth.ts:35,75,132`; `contact.controller.ts:163`). **Must verify `JWT_SECRET`/`JWT_REFRESH_SECRET` are actually and consistently set in the production environment, then remove all hardcoded fallbacks (fail closed) before adding any new privileged account.** If any deployed process instance is ever missing the env var, sign and verify disagree on the secret, and a known-literal default becomes a forgeable token if that literal is ever the one in effect.
2. **`admin-dashboard` has no server-side route guard (§1.2).** This must be closed as part of shipping the staff feature — otherwise a market manager's own customer-session token can render the admin shell before any API call is checked.
3. **The permission system is decorative, not enforced (§2.2).** Today there is no way to give anyone less than full `admin` power. This is the actual blocker the whole `staff_memberships` design exists to solve — it must ship with real enforcement wired to every new market-ops route, not another seeded-but-unused table.
4. **Shipping mock-rate fallback is silent in production (§11)** — must fail loudly before a market manager is given fulfillment responsibility that depends on real rates.
5. **`.env.production.example` omits `STRIPE_WEBHOOK_SECRET`** while the prod compose requires it (independently reconfirmed, matches the prior audit's finding) — part of the broader "is prod env actually correctly and completely configured" question worth resolving before onboarding new privileged users, even though it isn't staff-access-specific.
6. **Migration `026`'s broken FK (§12)** is a landmine for whoever next runs `migrate:up` against a database whose exact history isn't confirmed — must be resolved/understood before the new `staff_memberships` migration is added to the same sequence.

None of items 1, 3, 5, or 6 are new work created by this feature — they are pre-existing gaps that a new remote, privileged account would be the first real test of. Recommend treating them as go/no-go gates, not nice-to-haves.

---

## 14. Staged implementation plan

**Phase 1 — Additive schema + enforcement (no data migration, no UI yet)**
1. Add `staff_memberships`, `staff_audit_log` (§4) as a new migration, numbered after confirming current prod `schema_migrations` state (§12 gate).
2. Implement `requireStaff(...roles)` and `requirePermission(permission)` middleware in `tech-tools-api`, backed by the in-code permissions matrix (§5) — additive, doesn't touch `authorize()`.
3. Implement `applyMarketScope()` filter helper for orders and suppliers only (§6).
4. Fix JWT fallback-secret inconsistency (§13.1) — prerequisite, small, isolated.
5. Add `admin-dashboard` server-side route guard recognizing either legacy `user_type` or an active `staff_membership` (§13.2).

**Phase 2 — Staff invite flow for existing users**
6. Extend (not replace) the existing `admin_invitations` pattern, or add a parallel `staff_invitations` flow, that targets an *existing* `user_id` by email rather than always creating a new user row (closing the gap noted in §2.3).
7. Build minimal admin-dashboard UI: staff list, grant/revoke, market-scope assignment — gated behind `SUPER_ADMIN`/`OWNER` only, per §5.

**Phase 3 — Onboard the Cameroon manager as `MARKET_MANAGER`, scope = `['CM']`**
8. Grant via the Phase 2 flow to the founder's existing account or a real customer account for the manager — no `user_type` change.
9. Verify: manager sees only CM orders/suppliers, cannot see EU/global data, cannot invite other staff, cannot touch settings/Stripe config.

**Deferred / explicitly out of scope for Phase 1–3:**
- Product/catalog market tagging (§6 caveat) — separate schema decision.
- i18n/currency/tax/shipping/postal-code fixes for actual CM customer-facing sales (§9) — separate, higher-priority track from staff access.
- Shipping adapter hard-fail behavior (§11) and staging environment build-out (§10) — should land before Phase 3 go-live, but are independent workstreams that can run in parallel with Phases 1–2.

---

## 15. Migration plan

1. **Prerequisite (blocking):** obtain/inspect production's actual `schema_migrations` table contents before writing or numbering any new migration file. Confirm whether `026` is present, and if so how it got there given its broken FK (§12) — do not guess.
2. New migration file, additive only: `CREATE TYPE staff_role`, `CREATE TABLE staff_memberships`, `CREATE TABLE staff_audit_log`, plus supporting indexes. No `ALTER`/`DROP` on any existing table. No data backfill needed — the table starts empty; the founder's own grant is the first row, added by application code (the invite-accept flow), not by the migration itself.
3. Apply first to a non-production database (§10's staging recommendation) with a copy of production's actual schema, not just `001`-through-latest run fresh — to catch exactly the kind of `026`-style drift this audit flagged.
4. No changes to any already-applied migration file, per the task's explicit constraint.

---

## 16. Rollback plan

- **Schema rollback:** `staff_memberships`/`staff_audit_log`/`staff_role` enum are net-new objects with no inbound FKs from existing tables — a `DROP TABLE`/`DROP TYPE` rollback migration is safe and non-destructive to any existing data, since nothing else references them.
- **Access rollback (no schema change needed):** revoking a specific manager is `UPDATE staff_memberships SET status='revoked', revoked_at=now(), revoked_by=$actor WHERE id=$id` — instant, reversible, and logged in `staff_audit_log`. This is the expected day-to-day "rollback," not a migration revert.
- **Middleware rollback:** `requireStaff`/`requirePermission` are additive middleware only used on new routes — if something goes wrong, those specific routes can be disabled/reverted without affecting any existing `authorize()`-gated route.
- **No production data at risk at any point:** this design never mutates `users.user_type`, never touches existing orders/products/suppliers rows (only *reads* them through new scoped queries), and the only new writes are to the two new tables.

---

## 17. Tests required

- **Unit:** permissions matrix (§5) — every role/resource/action combination returns the expected allow/deny, including the `market_scope = NULL` (global) vs populated (scoped) cases.
- **Integration (API):** a `MARKET_MANAGER` scoped to `['CM']` can view/edit CM orders and CM suppliers, and gets 403/empty-result on EU/global equivalents; a `SUPPORT_AGENT` cannot reach refund or supplier-management endpoints; no role below `SUPER_ADMIN` can call the staff-invite/revoke endpoints.
- **Integration (dashboard):** a plain customer session (no staff row, `user_type='customer'`) cannot render the `(dashboard)` shell at all post-fix (§13.2) — this is the regression test for the gap found in §1.2.
- **Regression:** existing `authorize('admin','super_admin')` routes and existing admin accounts continue to work completely unmodified — this feature must not require any change to how current admins authenticate.
- **Migration test:** the new migration applies cleanly against a copy of production's actual current schema (post §15 step 1 investigation), not just a fresh `001..latest` run.
- **Manual/dry-run:** grant a real test account `MARKET_MANAGER`/`['CM']` in staging (once §10 exists) and walk the actual CM-manager workflow — view orders, view/import CM suppliers — end to end before touching production.

---

## 18. Recommended smallest safe Phase 1

Ship exactly this, nothing more, before the Cameroon manager touches anything:

1. `staff_memberships` + `staff_audit_log` tables (§4), additive migration, applied only after the production `schema_migrations` check (§12/§15 step 1).
2. `requireStaff`/`requirePermission` middleware enforcing **one single role for launch: `MARKET_MANAGER`**, scoped `market_scope = ['CM']`, with permissions limited to **orders (view/edit, no refund yet) + suppliers (view/manage) + inventory (view)** — i.e. the top few rows of §5's matrix, not the full eight-role system. `CATALOG_MANAGER`/`ORDER_MANAGER`/`MARKETING_MANAGER`/`SUPPORT_AGENT`/`OWNER` distinctions can be added later once `MARKET_MANAGER` is proven; they don't need to exist as enforced code on day one, only as reserved enum values so the type doesn't need another migration later.
3. The `admin-dashboard` server-side route guard fix (§13.2) — mandatory, not optional, since this is precisely the scenario (customer session reaching the shell) the whole feature is built to avoid.
4. The JWT fallback-secret fix (§13.1) — mandatory prerequisite, small and isolated.
5. Grant the founder's chosen account (existing customer or new) a single `MARKET_MANAGER` row with `market_scope=['CM']` via a manual, audited SQL insert (or the minimal invite-accept extension from §14 Phase 2, if time allows) — **not** by touching `user_type`.
6. Explicitly **do not** ship in Phase 1: refunds, staff self-service invite UI, catalog market-tagging, i18n/tax/shipping/postal-code fixes, or any of the other seven roles beyond `MARKET_MANAGER`.

This gives the founder a real, testable, reversible way to let the Cameroon manager work inside the admin system — scoped to CM orders/suppliers/inventory only — without ever granting `admin`/`super_admin`, without mutating the existing customer account model, and without touching a single already-applied migration or existing table's data.
