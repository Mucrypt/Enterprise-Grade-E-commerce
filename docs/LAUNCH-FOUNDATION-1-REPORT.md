# LAUNCH-FOUNDATION-1 — Report

**Date:** 2026-08-09
**Scope:** Safe commerce + staging + operations readiness foundation, per the phase brief. No `staff_memberships` migration, no admin-access grants, no `users.user_type` changes, no production deploy, no production database changes — all of that remains explicitly deferred.
**Environment:** All work done and verified locally against the repository at `/home/mukulah/Enterprise-Grade-E-commerce`. Nothing in this phase touched the live Hetzner server; the founder's SSH session there was never used by this work.

---

## 1. Exact files changed

**New files:**
- `docs/PRODUCTION-MIGRATION-STATE-CHECK.md` — read-only inspection commands (§5 below)
- `docs/MARKET-OPS-DASHBOARD-PLAN.md` — design-only proposal
- `tech-tools-api/src/config/jwt.config.ts` + `jwt.config.test.ts`
- `tech-tools-api/src/config/shipping.config.ts` + `shipping.config.test.ts`
- `tech-tools-api/src/database/inventory-reconciliation.ts` + `inventory-reconciliation.test.ts`
- `tech-tools-api/src/api/v1/products/product.controller.createProduct.test.ts`
- `tech-tools-api/src/api/v1/suppliers/supplier-import.controller.test.ts`
- `tech-tools-api/src/services/shipping/carriers/fedex.shippingSafety.test.ts`
- `tech-tools-mobile-app/src/config/env.ts`
- `tech-tools-mobile-app/.env.example` (gitignored by the repo's root `.env.*` rule, same as every other app's `.env.example` — needs `git add -f` if you want it version-controlled, matching how the existing ones got in)
- `admin-dashboard/lib/admin-role-cookie.ts`
- `admin-dashboard/middleware.ts`

**Modified files:**
- `tech-tools-api/src/middleware/auth.ts`, `src/api/v1/auth/auth.controller.ts`, `src/api/v1/books/books.controller.ts`, `src/api/v1/library/library.controller.ts`, `src/api/v1/contact/contact.controller.ts` — JWT secret centralization
- `tech-tools-api/src/api/v1/products/product.controller.ts` — transactional product+inventory creation, `total_stock` on `getProductById`
- `tech-tools-api/src/api/v1/suppliers/supplier-import.controller.ts` — inventory row creation on CSV commit
- `tech-tools-api/src/services/shipping/carriers/base.ts`, `fedex.ts`, `ups.ts`, `dhl.ts` — mock-shipping gating
- `tech-tools-api/src/api/v1/shipping/shipping.controller.ts` — `ratesAvailable`/`message` on empty rate responses; credential-leak fix in `getEnabledCarriers`
- `tech-tools-api/src/index.ts` — shipping carrier initialization at boot
- `tech-tools-api/.env.example`, `.env.production.example` — `ALLOW_MOCK_SHIPPING` documentation
- `tech-tools-api/package.json` — `inventory:reconcile*` scripts
- `tech-tools-mobile-app/src/api/index.ts`, `src/utils/index.ts`, `src/services/event-tracking.ts` — use central env config instead of hardcoded/dead URLs
- `tech-tools-mobile-app/eas.json` — explicit per-profile `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_APP_ENV`, new `staging` profile
- `admin-dashboard/contexts/AuthContext.tsx`, `app/login/page.tsx` — role-cookie set/clear, auto-redirect for already-valid sessions

**Note on an incidental side effect I reverted:** running `npm run lint` in `tech-tools-mobile-app` triggered Expo's auto-ESLint-setup, which rewrote `package.json`/`package-lock.json` (adding `eslint`/`eslint-config-expo` and ~216 transitive packages) and created `eslint.config.js`. That wasn't part of this phase's scope, so I reverted it (`package.json` is back to exactly its committed state; `package-lock.json` differs only by two unrelated transitive patch-version bumps that `npm install` normalized). Mobile still has **no ESLint config** — see §6.

---

## 2. Bugs fixed (not just new capability)

1. **Three different hardcoded JWT fallback secrets** (`'default-secret'`, `'development-secret'`, plus a bare non-null-assertion crash path) across 5 files, meaning sign/verify could disagree on which literal secret was in effect if `JWT_SECRET` was ever unset. Centralized into `src/config/jwt.config.ts`; production now refuses to boot if `JWT_SECRET`/`JWT_REFRESH_SECRET` are missing or blank, instead of silently defaulting.
2. **Mobile app hardcoded the production API URL** in three files (`api/index.ts`, `utils/index.ts`, `event-tracking.ts`), so every build — including local dev builds — talked to production. Now resolved from `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_APP_ENV`, explicit per EAS build profile, with a loud failure (not a silent localhost/production fallback) for any non-development build missing the config.
3. **New and CSV-imported products never got a matching `inventory` row.** `products.stock_quantity` was written but checkout only ever trusts `inventory.available_stock` — so every newly created or supplier-imported product had real available stock of 0 and would fail checkout with "Insufficient stock" regardless of what the admin UI showed. Fixed transactionally in both `createProduct` and `commitSupplierImport` (the latter without overwriting stock for products that already have an inventory row from another source).
4. **Shipping carriers (FedEx/UPS/DHL) silently returned fabricated rates, tracking, labels (`MOCK_LABEL_DATA_BASE64`), address-validation, and cancellation results** whenever credentials were missing or any live API call failed — unconditionally, in every environment including production. Now gated behind `ALLOW_MOCK_SHIPPING`, which is hard-disabled in production regardless of the flag's value; missing/failed carrier calls throw a clear `ShippingUnavailableError` instead.
5. **`admin-dashboard` had no server-side route guard** — any authenticated (even non-admin) session's browser would render the full dashboard shell client-side before a single API call had the chance to 403. Closed with a role-cookie set at login/session-load and a new `middleware.ts` that redirects before the shell ever renders. (This is a coarse UX/defense-in-depth gate, not a new security boundary — see §7.)
6. **Credential-leak bug found while implementing carrier-health visibility:** `getEnabledCarriers` did `SELECT * FROM shipping_carriers`, which includes the raw `credentials` JSONB column (carrier API keys/secrets), and returned it directly in the JSON response to any `admin`/`super_admin` token. Fixed to match the redaction pattern already correctly used by the sibling `getShippingCarriers` endpoint.
7. **`ShippingService.initialize()` was only ever called from an admin "update carrier" action**, never at server startup — so a fresh deploy or restart had zero enabled carriers until an admin happened to open that specific settings screen. Now initialized at boot in `src/index.ts` (non-fatal on failure, same as DB/Redis connect calls).

---

## 3. Tests added

All in `tech-tools-api` (the only app with an existing test runner — see §6 for why the other three apps only got type-check/build/lint, not new tests):

- `jwt.config.test.ts` — 6 tests: correct secret used when configured, throws in production when either secret is missing/blank, falls back safely outside production, default expiries.
- `shipping.config.test.ts` — 4 tests: mock never allowed in production even with the flag set, disabled by default outside production, allowed only when explicitly enabled, non-`"true"` values treated as disabled.
- `fedex.shippingSafety.test.ts` — 5 tests: throws instead of fabricating rates/labels in production, throws outside production when not explicitly enabled, returns mock data only when explicitly enabled outside production (representative of the same pattern applied to UPS and DHL).
- `product.controller.createProduct.test.ts` — 3 tests: product+inventory created together in one transaction, rollback + client release on inventory-insert failure, no transaction opened when the SKU already exists.
- `supplier-import.controller.test.ts` — 1 test: an inventory row is ensured for every committed row (create and update), using an existence-check `INSERT ... WHERE NOT EXISTS` rather than `ON CONFLICT` (there is no unique constraint on `inventory.product_id` to conflict against — confirmed against the actual migration before writing this).
- `inventory-reconciliation.test.ts` — 7 tests: discrepancy detection (match / mismatch / missing row), read-only (never mutates input), and that proposed repair SQL is only ever generated for the missing-row case, never for an existing-but-mismatched row.

**39 tests total, all passing** (11 suites, including 4 pre-existing suites unrelated to this phase — all still pass).

---

## 4. Test/build results

| App | type-check | test | build | lint |
|---|---|---|---|---|
| tech-tools-api | ✅ clean | ✅ 39/39 passing | ✅ clean (`tsc`) | ❌ pre-existing — no ESLint config committed (fails identically before and after this phase) |
| admin-dashboard | ✅ clean | *(no test script exists)* | ✅ clean — 36 routes generated, middleware picked up | ⚠️ pre-existing baseline: 374 problems / 236 errors, entirely in files this phase didn't touch except two pre-existing `any`-typed `catch` blocks in files I edited elsewhere (not introduced by my changes — verified line-by-line) |
| e-commerce-web-store | *(build includes `tsc -b`)* | *(no test script exists)* | ✅ clean; `perf:budget` — all 6 bundle budgets PASS | not run (untouched this phase) |
| tech-tools-mobile-app | ✅ clean | *(no test script exists)* | *(EAS build not run — no CI/build infra invoked this phase)* | ⚠️ pre-existing baseline: 67 problems / 13 errors, none in files this phase touched |

No regressions were introduced anywhere. Every ❌/⚠️ above is a pre-existing gap, confirmed by checking that the specific flagged lines predate this phase's edits.

One build note: the admin-dashboard build printed `The "middleware" file convention is deprecated. Please use "proxy" instead` (Next.js 16 renamed the convention). `middleware.ts` still works and is picked up correctly — I left it as-is rather than guess at an unfamiliar renamed API surface on a live-adjacent app; renaming to `proxy.ts` is a safe, small follow-up worth doing deliberately, not blind.

---

## 5. Production migration read-only commands

See **`docs/PRODUCTION-MIGRATION-STATE-CHECK.md`** — a full set of `SELECT`-only commands for the founder to run over the existing SSH session against `techtools-postgres-prod`, using the container's own `POSTGRES_USER`/`POSTGRES_DB` env so no credential needs to be typed. Confirms: whether `schema_migrations` reflects reality, whether migration `026` (and therefore `027`–`039`) actually ran, and whether `admins` truly doesn't exist in production (expected) or was created out-of-band (would need investigation).

**No migration was created or run in this phase.** This is a hard prerequisite for `staff_memberships` (from `MARKET-OPS-STAFF-ACCESS-AUDIT.md`) and for any other future migration — not resolved by anything in this report.

---

## 6. Remaining blockers

1. **Production migration history unconfirmed** (§5) — blocks any new migration, full stop.
2. **Mobile app has no analytics consent gate at all** (confirmed during the analytics audit this phase performed) — the web storefront gates every event behind `hasAnalyticsConsent()`; mobile fires events unconditionally. Should be closed before mobile data feeds the Market Ops Dashboard proposed in `docs/MARKET-OPS-DASHBOARD-PLAN.md`.
3. **Mobile never calls `trackSearch`, `trackCheckoutStart`, or `trackPaymentSuccess`** from `search.tsx`, `checkout.tsx`, or the cart screen, despite the tracking service supporting them — the funnel view in the dashboard proposal would be incomplete on mobile until these are wired up.
4. **Backend's `/analytics/events/batch` silently swallows individually-invalid events** (catches per-row insert errors, logs a warning, still returns `200` with a short `insertedCount`) — worth tightening before treating analytics data as fully reliable.
5. **i18n/tax/shipping/postal-code/payment-method gaps for actually selling to Cameroon** (flat 8% tax, required postal code, no mobile money) are exactly as found in the prior audit — untouched this phase, and explicitly a separate, higher-priority track from admin/staff access.
6. **No ESLint config in `tech-tools-api`** (`npm run lint` fails outright — "ESLint couldn't find a configuration file") and **large pre-existing lint baselines in admin-dashboard and mobile** — none introduced by this phase, but worth a dedicated cleanup pass at some point.
7. **The admin auth guard shipped this phase is a coarse UX gate, not a cryptographic one** — see §7 for why, and what the real fix looks like.

---

## 7. Admin auth guard — what shipped vs. the real fix (LAUNCH-FOUNDATION-1B)

**What shipped:** `admin-dashboard/lib/admin-role-cookie.ts` + `admin-dashboard/middleware.ts`. At login and on every session-load check, the client sets a plain (non-HttpOnly) cookie mirroring the confirmed `userType` (`admin`/`super_admin` only). `middleware.ts` runs server-side, before any page renders, and redirects to `/login` if that cookie is missing or not an admin role. This closes the concrete gap found in the audit: a session without a confirmed admin role can no longer get the dashboard shell rendered at all, whereas previously the only check was a `useEffect` in `(dashboard)/layout.tsx` that rendered children first and redirected after the fact.

**What this is not:** a security boundary. The cookie is client-set and exactly as spoofable via dev tools as `localStorage` was — anyone who could forge a customer-role JWT could equally forge this cookie. Real authorization is untouched and still lives entirely server-side in the API's `authenticate`/`authorize` middleware on every request; this phase changed zero lines there.

**Why not the real (HttpOnly session/BFF) fix in this phase:** that requires the API to issue an HttpOnly `Set-Cookie` at login (additive — doesn't have to replace the existing JSON token response other clients rely on), admin-dashboard's fetch layer to send it (`credentials: 'include'`), and — critically — correct `Domain`/`SameSite`/`Secure` cookie attributes matching the *actual* production domain topology (subdomain vs. path-based routing through the existing Nginx config). I don't have enough certainty about that exact production topology to get those attributes right blind, and a wrong `SameSite`/`Domain` value would silently break admin login in production — precisely the kind of live-system risk this phase was told to avoid. The phase brief's own instruction was explicit on this: implement the small safe piece now, document the larger migration path rather than force it.

**Proposed LAUNCH-FOUNDATION-1B scope:**
1. Confirm exact cookie-domain topology from the real Nginx/Cloudflare config (not guessed).
2. API: on login, issue an HttpOnly, `Secure`, correctly-scoped session cookie (JWT or opaque session ID) alongside the existing JSON response — additive, other clients unaffected.
3. `middleware.ts`: verify the cookie's JWT signature server-side using the same centralized `JWT_SECRET` from `tech-tools-api/src/config/jwt.config.ts` (Next 16 middleware supports the Node.js runtime, not just Edge, so this is straightforward once the domain question is settled).
4. Only then retire the coarse role-cookie approach from this phase.
5. Also worth folding in: rename `middleware.ts` → `proxy.ts` per the Next 16 deprecation notice (§4), and reconcile the two parallel client-side auth stores found during this work (`contexts/AuthContext.tsx`, actively used, vs. the separate Zustand `lib/auth-store.ts`, used only by two pages) — not touched this phase to avoid breaking those pages blind.

---

## 8. Rollback notes

Every change this phase is independently revertable without touching production data:

- **JWT/shipping config, inventory fixes, mobile env config:** plain code changes in a git working tree — `git checkout` any individual file, or revert the whole phase's commit(s), with zero data-migration involved anywhere (no schema changes were made).
- **Admin role cookie/middleware:** deleting `admin-dashboard/middleware.ts` alone fully disables the new gate and returns to prior (client-side-only) behavior; the cookie itself is inert without the middleware reading it.
- **`ALLOW_MOCK_SHIPPING`:** unset (or never set) it — behavior is unchanged from "no mock" in every environment; setting it only affects non-production.
- **Inventory reconciliation script:** read-only by construction; nothing to roll back. Its `--repair-dry-run` output is never executed automatically.
- **No database migrations were created or run**, so there is nothing schema-side to roll back for this phase specifically.

---

## 9. Readiness status for MARKET-OPS-1

**BLOCKED** — specifically and only on:

1. **Production migration state is unconfirmed.** `docs/PRODUCTION-MIGRATION-STATE-CHECK.md` must be run by the founder and its output reviewed before the `staff_memberships` migration (or any migration) from `docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md` is written or applied. This is the explicit, stated gate for this entire initiative and nothing in this phase resolves it — only the founder running those commands can.

Everything else this phase was asked to do — mobile env separation, JWT hardening, inventory source-of-truth fixes, shipping mock-safety, the admin dashboard route-guard gap, and the analytics/dashboard-plan audits — is **done, tested, and does not block MARKET-OPS-1** on its own. Once the migration-state output comes back clean (or the `026` situation is understood and handled), MARKET-OPS-1's Phase 1 scope (the single `MARKET_MANAGER` role, `['CM']`-scoped, orders/suppliers/inventory only, no refunds — per the smallest-safe-Phase-1 recommendation in `MARKET-OPS-STAFF-ACCESS-AUDIT.md`) has no other outstanding technical blocker from this audit.
