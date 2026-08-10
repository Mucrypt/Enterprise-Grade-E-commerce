# ADMIN-2B — Analytics 2.0 / Business Intelligence

**Phase:** ADMIN-2B (builds directly on ADMIN-2A.5's market-scope foundation and LOCALIZATION-FOUNDATION-1; neither is modified here)
**What this phase built:** a consolidated, filterable, scope-aware analytics workspace at `/dashboard/analytics` (9 tabs) backed by 8 new aggregated endpoints, replacing the previous single-page global-only UI. The existing analytics engine (`events_core`, `user_sessions`, `analytics.controller.ts`'s original endpoints, `metrics.broadcaster.ts`, Socket.IO real-time infra) is untouched and still running underneath — this phase is additive.

---

## 1. Analytics capability audit

Audited before writing any code: `tech-tools-api/src/api/v1/analytics/` (both controller/routes), `event.service.ts`, `metrics.broadcaster.ts`, `websocket.service.ts`, every relevant migration (`026_unified_analytics_schema.sql`, `037_live_visitor_analytics.sql`, `001_initial_schema.sql`, `025_supplier_profitability_controls.sql`, `036_supplier_catalogue_import.sql`, `006_coupons_and_reviews.sql`, `016`/`024_newsletter_*.sql`), the admin-dashboard's `/dashboard/analytics` page and `useRealtimeMetrics`, and `tech-tools-mobile-app`'s event-tracking instrumentation.

### Capability matrix

| Data | Status | Notes |
|---|---|---|
| `orders`/`order_items`/`payments` (revenue, order/payment status, currency) | **AVAILABLE_AND_TRUSTWORTHY** | Real transactional tables; `orders.currency` defaults to `'EUR'`. |
| `user_sessions` (device, browser, referrer, full UTM set, `country_code`/`country_name`/`city` via geoIP) | **AVAILABLE_AND_TRUSTWORTHY** | `country_code` is a reliable `CHAR(2)` ISO code (`geoip-lite`), unlike order shipping addresses. |
| `events_core` for `product_view`/`add_to_cart`/`search`/`page_view` | **AVAILABLE_AND_TRUSTWORTHY** (web) | Mobile fires these too (see below). |
| `events_core.payload->>'resultsCount'` for search | **AVAILABLE_AND_TRUSTWORTHY** | Confirmed real field name (camelCase), not the snake_case shown in the migration file's own stale inline comment. |
| `events_core` for `checkout_start`/`payment_success` | **AVAILABLE_BUT_PARTIAL** | Reliable from web. **Never fired from the mobile app** — defined in `tech-tools-mobile-app/src/services/event-tracking.ts` and `useEventTracking.ts` but not called from any screen (confirmed by exhaustive call-site search). Every funnel/checkout-abandonment/conversion figure derived from these two event types now carries an explicit data-quality flag. |
| `products.cost_price` → per-order-item gross margin | **AVAILABLE_BUT_PARTIAL** | Real column, but not populated for every product; margin is computed only from items with a known cost price, with a `marginCoveragePercent` reported alongside so a low-coverage period is visibly approximate, never a false-precision number. |
| `product_unit_economics`/`product_operational_flags` | AVAILABLE, not used this phase | Populated only when a supplier admin explicitly runs "recompute economics" — sparser and less current than `products.cost_price` for a broad table; the simpler, more complete source was used instead. |
| `refunds`/`returns` tables | **MISSING** | No `CREATE TABLE` for either exists anywhere in the migration history — confirmed via the pre-existing `tableExists()` helper, which every refund-rate calculation (old and new) already gates on. Refund rate reports `null`/"unavailable" rather than a fabricated 0. |
| `event_aggregates_hourly` | **MISSING (unpopulated)** | Table exists but `EventService.refreshHourlyAggregates()` is never invoked by any cron/worker — querying it would silently return zero rows even with real underlying activity. **Not used anywhere in this phase** — every new endpoint aggregates `events_core` directly. Flagged as a future performance optimization (§8), not a data source today. |
| `alerts` table market/country dimension | **MISSING** | No such column — confirmed in ADMIN-2A.5 too. A market-scoped caller gets an honest omission with a note, never the global count relabeled as theirs. |
| Ad spend / CPA / CAC / ROAS | **MISSING** | No spend table exists anywhere. Not fabricated; Acquisition's response shape is deliberately structured so these can be added per-channel later without changing the attribution model. |
| `coupon_usage` | AVAILABLE, not used this phase | Real, trigger-maintained table; no explicit ADMIN-2B requirement consumed it this phase. |
| `email_messages`/`contact_analytics` (support) | **UNRELIABLE for market scoping** | No market/country field (reconfirmed from ADMIN-2A.5); not touched. |
| Mobile app analytics consent | **MISSING** | No consent/opt-in mechanism exists in the mobile app at all (the web store has one — `consentStore.ts` — mobile does not). Documented as a gap (§9), not fixed this phase. |

---

## 2. Endpoints added

All new, in `tech-tools-api/src/api/v1/analytics/analytics-v2.controller.ts` (separate file — `analytics.controller.ts`'s original 12 endpoints are unmodified except exporting the pre-existing `tableExists()` helper for reuse). Registered in `analytics.routes.ts` under the existing `/analytics` prefix:

| Endpoint | Purpose |
|---|---|
| `GET /analytics/overview` | Revenue, orders, AOV, visitors, conversion, checkout abandonment, refund rate, returning-customer rate, gross margin — each with a period-over-period comparison. |
| `GET /analytics/sales` | Revenue/orders/AOV trend, units sold, revenue by product/category/country, order/payment status distribution, cancellation & refund rate. |
| `GET /analytics/funnel` | Canonical Sessions → Product View → Add to Cart → Checkout Start → Payment Success funnel, segmentable by device/source/campaign/product/category, with per-stage data-quality flags. |
| `GET /analytics/products` | Product intelligence table: views, unique visitors, add-to-carts, purchases, revenue, conversion, cart-to-purchase rate, current stock, margin (where known); sortable 7 ways including "high demand + zero stock". |
| `GET /analytics/search-demand` | Top/zero-result searches, searches by country, search trend, products viewed-but-unavailable, high-view/low-cart and high-cart/low-purchase products, top product per country. |
| `GET /analytics/acquisition` | First-party UTM attribution (source/medium/campaign) with sessions → product views → add-to-carts → checkout starts → orders → revenue → conversion, per channel. |
| `GET /analytics/operations` | Active/recent alerts (global only), payment failures, cancellations, refunds, overdue shipments, stuck orders, supplier import failures, low-stock+high-demand list. |
| `GET /analytics/country-performance` | Per-country visitors/orders/revenue/conversion/top product/top search/top channel — explicitly labeled "Country Performance", not "Markets". |

No new endpoint for "Real Time" — it deliberately reuses the existing Socket.IO infrastructure (`useRealtimeMetrics`/`useRealtimeAlerts`, `metrics.broadcaster.ts`) plus the pre-existing `GET /analytics/visitors/live` REST fallback, per the explicit instruction to build on it rather than duplicate it.

### Query parameters (validated, every endpoint)

`from`, `to` (ISO dates, defaulting to the last 30 days), `comparisonMode` (`previous_period` | `previous_year` | `none`), `compareFrom`/`compareTo` (explicit override), `country` (further narrows scope — see §4), plus per-endpoint: `productId`/`categoryId` (UUID-validated, silently ignored if malformed rather than erroring), `device`/`source`/`campaign` (Funnel), `sort`/`limit` (Products). Invalid dates or an inverted range return `400` before any query runs.

---

## 3. SQL / query strategy

- **Shared helper module** (`analytics-query.helpers.ts`) owns date-range parsing, comparison-period math, and market-scope resolution — every endpoint uses the same `resolveStaffScope()`/`sessionCountryScopeFilter()`/`orderCountryScopeFilter()` primitives rather than seven slightly different reimplementations. `resolveStaffScope()` mirrors the exact global-vs-scoped logic `getMarketOverview()` (ADMIN-2A.5) already established.
- **Two scope primitives, matched to two different data-reliability levels**: `sessionCountryScopeFilter()` matches `user_sessions.country_code` directly (a trustworthy ISO `CHAR(2)`, no ambiguity); `orderCountryScopeFilter()` wraps `LOWER(...)` and expands against both ISO code and full country name (via `expandCountryScopeForMatching()`, unchanged from ADMIN-2A.5) because `orders.shipping_address->>'country'`'s historical format is still unconfirmed.
- **Server-side aggregation only** — every endpoint runs `GROUP BY`/`COUNT`/`SUM` in Postgres; nothing fetches a raw event or order table into Node and reduces it in JavaScript. Product Intelligence and Search & Demand cap result sets at 20–50 rows via `LIMIT`.
- **Split queries over risky joins**: Acquisition and Country Performance deliberately run 2 (or more) separate `GROUP BY` queries merged by key in JS, rather than one query spanning `user_sessions → events_core → orders` — a single such join risks double-counting an order's revenue if a session ever fans out against more than one matching event row. Each split query stays simple enough to unit test directly.
- **Country Performance keys everything by the visiting session's `country_code`, not `orders.shipping_address`** — a deliberate choice to give every metric (visitors, orders, revenue, top product, top search, top channel) one consistent, reliable join key, sidestepping the shipping-address format ambiguity entirely. Documented in the response's own `dataQuality.note` (ISO-country vs. shipping-country can differ in edge cases — gifting, VPN use).
- **Every numeric value is null/NaN/Infinity-safe by construction**: `safeNumber()` coerces pg's bigint strings and nulls to `0`; `safeDivide()` returns `0` on a zero denominator instead of `Infinity`; `compareToPreviousPeriod()` returns `null` (not `0` or `Infinity`) for `percentChange` when the previous value was legitimately zero or no comparison period exists. No endpoint calls `.toFixed()` on a raw query result.

---

## 4. Permission model / scoped analytics behavior

- New middleware: `requireAnyPermissionOrLegacyRole(permissions[], ...legacyRoles)` in `middleware/staff.ts` — every ADMIN-2B endpoint is gated by `analytics.view` **OR** `analytics.view_market` (plus the existing legacy-admin bootstrap), since the two permissions are mutually exclusive in the staff role matrix (`ADMIN`/`CATALOG_MANAGER`/`ORDER_MANAGER`/`MARKETING_MANAGER` hold the former; `MARKET_MANAGER` holds the latter; `OWNER`/`SUPER_ADMIN` hold both).
- **The GLOBAL-vs-SCOPED decision happens inside each controller, not at the route gate** — `resolveStaffScope(req)` checks the caller's actual `staff_memberships` (any `market_scope IS NULL` membership ⇒ global; otherwise the union of their scoped countries; an explicitly empty scope ⇒ fails closed, matching every other scoped surface in this codebase).
- **`?country=` can only ever narrow, never widen**: a global caller can filter down to any country; a `MARKET_MANAGER` requesting a country outside their own `market_scope` collapses to the same fails-closed empty-scope result as if no market had been granted at all — verified by a dedicated test (`getOverview`'s "cannot widen scope" case).
- **No endpoint ever fetches global data and filters client-side** — every SQL `WHERE` clause is built server-side from the resolved scope before the query runs.
- Alerts (Operations) are the one deliberate exception to "always return something": for a scoped caller, `activeAlerts`/`recentAlerts` are `null`/`[]` with an explanatory `dataQuality.alertsNote`, and **the `alerts` table is never even queried** for a scoped caller (verified by test) — not filtered-and-empty, genuinely skipped, since there's no country column to filter by in the first place.

---

## 5. Pages/components built (admin-dashboard)

**Shell** (`components/analytics/`): `AnalyticsShell`, `AnalyticsTabs`, `AnalyticsFilterBar`, `DateRangePicker` (5 presets + custom), `ComparisonSelector`, `CountryFilter`/`SourceFilter`/`CampaignFilter`/`DeviceFilter`/`ProductFilter` (`filters.tsx`), `MetricCard` (pre-existing, reused), `TrendMetric` (adapts a `PeriodComparison` into `MetricCard`'s trend display, never rendering a fabricated 0%/arrow when `percentChange` is `null`), `ChartCard`, `AnalyticsTable` (generic sortable-column table with a shared empty state), `DataQualityNotice` (inline + banner variants), `ExportButton` (client-side CSV from already-fetched, already-scoped data — see §7). `useAnalyticsFilters` hook is the single source of truth every tab reads filter state from.

**Recharts** (already a dependency — confirmed via `package.json` before writing any chart code; no new charting library added) powers the Sales revenue trend (`LineChart`), Funnel (horizontal `BarChart`, lighter-colored bars for partially-instrumented stages), and Search & Demand's search-trend (`LineChart`).

**9 tabs**, each an independently data-fetching component (`components/analytics/tabs/`): Overview, Real Time, Sales, Funnel, Products, Acquisition, Search & Demand, Operations, Country Performance — assembled in `/dashboard/analytics/page.tsx` via `AnalyticsShell` + `AnalyticsTabs`. `RequirePagePermission` now gates on `['analytics.view', 'analytics.view_market']` with `mode='any'` (superseding the ADMIN-2A.5-era `analytics.view`-only restriction — see §11).

`Sidebar.tsx`'s Analytics nav entry updated to match (`permissions: [...]` instead of the single `analytics.view`), with an updated comment explaining the change.

---

## 6. Filter architecture

One `AnalyticsFilterBar` per tab, rendering only the controls that tab's endpoint actually accepts (`visible: FilterKey[]`): date range + country are effectively universal; comparison mode only where the endpoint supports periods (Overview); source/campaign/device only on Funnel. `productId`/`categoryId` are part of the shared filter state but have no dedicated input control in the bar — they're set by clicking a row in the Products tab (`onRowClick={(r) => filters.setField('productId', r.productId)}`), which every other tab's query already reads, so drilling from "this product is high-demand-zero-stock" into its Sales trend or Funnel is a single click. Filter state is plain React state (not URL-persisted) — see §11 for why that was a deliberate, documented deferral rather than a half-built feature.

---

## 7. Exports

`ExportButton`/`rowsToCsv()` generate CSV client-side from data the component **already has in memory** — the exact JSON the scoped, permission-checked endpoint returned. This needed no new backend route or permission logic: the data on screen for a `MARKET_MANAGER` is already market-scoped by the time it reaches the browser, so reformatting it as CSV can't expose anything beyond what's already rendered. Wired into Sales (trend/by-product/by-country), Products, Acquisition, and Country Performance.

---

## 8. Performance findings

- **No new indexes added.** Reviewed existing indexes on `events_core`/`user_sessions`/`orders`/`order_items` before writing any query (§ the pre-audit). Two gaps were found (no index on `orders.created_at`; no GIN index on `events_core.payload` for the `payload->>'searchQuery'`/`resultsCount` filters) but **not acted on** — both are pre-existing (the original `analytics.controller.ts` endpoints already scan `orders.created_at` unindexed), and adding an index is a migration this phase's constraints (no unnecessary migrations, no automatic deployment) argue against doing speculatively without a real query-plan/volume signal from production. Documented as a recommendation for whoever next touches `orders`/`events_core` migrations, not implemented.
- **`event_aggregates_hourly` was deliberately NOT used** (see capability matrix) — querying an unpopulated rollup table would be strictly worse than querying raw `events_core` directly, not a performance win. Wiring `refreshHourlyAggregates()` to an actual cron and switching long-range queries (90-day trends) to read from it is a natural ADMIN-2C-or-later optimization once real event volume justifies it.
- **React Query caching**: every tab uses `staleTime: 60_000` (matches this codebase's existing convention, e.g. `staleTime: 60 * 1000` in `StaffAccessContext`) for the period-based endpoints; Real Time keeps the pre-existing `refetchInterval: 20_000` REST fallback alongside the WebSocket push, unchanged. Nothing polls every second.
- **Result sets are bounded** everywhere: Product Intelligence defaults to 50 rows (max 200 via `?limit=`), Sales' by-product/by-country breakdowns cap at 20–25, Search & Demand's lists cap at 20–50.

---

## 9. Mobile analytics gap (re-audited, documented, not fixed)

Re-confirmed via exhaustive call-site search: `trackSearch`, `trackCheckoutStart`, and `trackPaymentSuccess` are fully defined in `tech-tools-mobile-app/src/services/event-tracking.ts` and `useEventTracking.ts` (identical event/payload shape to the web store's equivalents, including `resultsCount` in the search payload) but **never invoked from any screen** — `search.tsx` doesn't import the hook at all; `checkout.tsx` doesn't either, including at the exact point (`handlePlaceOrder`'s success branch, `paymentIntent?.status === 'Succeeded'`) where a `trackPaymentSuccess` call would go. `trackProductView`/`trackAddToCart`/`trackProductFavorite` (product detail screen) and global `page_view` tracking (`ScreenViewTracker`) **are** wired and firing correctly. Separately, the mobile app has **no analytics consent/opt-in mechanism at all** (the web store has `consentStore.ts`; mobile has nothing equivalent).

**Not fixed this phase.** Wiring the 3 missing calls is plausibly "truly small and isolated" code-wise (a few lines in 2 files, reusing already-built hooks), but was deliberately not attempted: there is no Expo runtime/simulator available in this environment to verify the change against a real checkout/payment flow, and a payment-confirmation code path is not one to edit unverified. Left as a documented, scoped, low-risk follow-up rather than an uncontrolled mobile change inside a backend/admin-dashboard phase.

---

## 10. Command Center integration

`app/(dashboard)/command-center/page.tsx` rewired to consume the **same** `analyticsV2Service.getOverview()`/`getOperations()` calls the Analytics workspace's Overview/Operations tabs use, replacing the ADMIN-2A.5-era split (a global-only `useRealtimeMetrics` path plus a separate `getMarketOverview` call for scoped users) with one summary service, scope-resolved per caller, consumed from two places — no duplicated aggregation logic. What legitimately stays separate: a "Right now" strip (active visitors, last-hour orders/revenue) still reads `useRealtimeMetrics` directly, since that's an instantaneous WebSocket signal, not a period aggregate — pulling it through `getOverview` would conflate two different concepts, not deduplicate them. The old `GET /analytics/market-overview` endpoint (ADMIN-2A.5) is untouched and still exists but is no longer called from Command Center; nothing else in the codebase was found to depend on it, so it was left in place rather than removed (removing a working, tested endpoint wasn't asked for and isn't free of risk).

---

## 11. Before/after Analytics architecture

**Before:** one page (`/dashboard/analytics`), 12 global-only endpoints (`analytics.controller.ts`), each independently gated `authorize('admin','super_admin')`, no comparison periods, no segmentation beyond a single `days` param, no market scoping, mixed date-window conventions (some endpoints ignored the page's own period selector).

**After:** that page is now a 9-tab workspace, backed by 8 new consolidated endpoints with a single shared date-range/comparison/scope model, reachable by both global viewers and `MARKET_MANAGER` (server-side scoped). The 12 original endpoints are unchanged and still serve Real Time's live-visitor table and (indirectly, via unchanged code) anything else already depending on them. `market-overview` (ADMIN-2A.5) is superseded in practice by `overview/operations` but not deleted.

---

## 12. Tests / results

**Backend:** 3 new test files, 71 new tests (27 + 44, see below), **192/192 backend tests passing** (22 test suites — up from 121/121 at the start of this phase), clean `tsc --noEmit`, clean `tsc` build.

- `analytics-query.helpers.test.ts` (27 tests) — date-range parsing/validation, `safeNumber`/`safeDivide`/`safeRound` never producing NaN/Infinity, `compareToPreviousPeriod` handling a null comparison period and a legitimately-zero previous value without `Infinity`, `resolveStaffScope`'s global/scoped/fails-closed cases, both scope-filter primitives.
- `analytics-v2.controller.test.ts` (44 tests, 8 `describe` blocks) — one per endpoint, covering: happy-path correctness with real numbers, an entirely-empty-data period never crashing/never NaN, invalid-date-range → 400 with zero queries issued, `MARKET_MANAGER` scope enforcement (SQL clause shape + response `scoped`/`markets`), the `?country=` narrow-only guarantee, malformed UUID filters silently ignored rather than erroring, the mobile-instrumentation data-quality note always present on Funnel, alerts never queried at all for a scoped Operations caller, and acquisition never emitting `roas`/`spend`/`cpa` fields.

**Frontend:** no new automated tests (admin-dashboard has no test runner — same situation LOCALIZATION-FOUNDATION-1 encountered in `e-commerce-web-store`, not reintroduced here since Playwright/RTL/vitest setup for a Next.js App Router project is a bigger investment than this phase's scope justifies on its own). Verified instead via `tsc --noEmit` (clean), `eslint` (zero new errors/warnings — the sole warning reported, an unused `Star` icon import in `Sidebar.tsx`, predates this phase), and a full production `next build` (all 38 routes compiled, including `/dashboard/analytics` and `/command-center`).

**Regression:** the full pre-existing backend suite (121 tests, unrelated to this phase) still passes unchanged alongside this phase's 71 new tests (192 total), and admin-dashboard's `next build` succeeds for every route (38/38).

---

## 13. Remaining gaps

- **No frontend automated tests** (see §12) — a real gap for a "world-class" bar, deferred rather than rushed.
- **Filter state is not URL-persisted** — switching tabs or reloading the page loses the current date range/filters. A real UX gap; deferred rather than half-built (query-string sync touches routing conventions this phase didn't want to disturb elsewhere).
- **No `ProductFilter`/category picker UI** — product/category filtering exists in every endpoint and is reachable by clicking a Products-tab row, but there's no standalone searchable product/category dropdown in the filter bar itself.
- **`orders.created_at`/`events_core.payload` indexing** — flagged, not acted on (§8).
- **Mobile checkout/search instrumentation gap** — documented, not fixed (§9).
- **Search-to-product attribution** — explicitly not attempted (no reliable link from a search query to the product(s) a shopper subsequently viewed exists in this schema); flagged in Search & Demand's own `dataQuality.note` rather than guessed at.
- **`event_aggregates_hourly` remains unpopulated** — not wired to a cron this phase; long-range (90-day) queries against raw `events_core` will get proportionally more expensive as event volume grows.
- **Reports/Customers tabs** — deferred per the phase's own explicit scope ("Customers/Reports can remain lighter or deferred if needed"); not built at all this phase (Overview's `returningCustomerRate` is the one customer-shaped metric that did ship, since it's a genuine Overview KPI, not a standalone Customers workspace).

---

## 14. Roadmap to ADMIN-2C / Global Commerce integration

- **ADMIN-2C** (per the existing `docs/ADMIN-PLATFORM-2-ROADMAP.md`): the "Recent activity" cross-organization audit feed Command Center still shows as an `EmptyState`; role-specific "My Work"/attention-queue data; Reports tab (scheduled/exportable reports, not just ad hoc CSV); URL-persisted analytics filters; frontend test coverage for the analytics workspace.
- **Global Commerce dependency**: once `docs/GLOBAL-COMMERCE-ARCHITECTURE.md`'s countries/markets schema lands, Country Performance can evolve from a country-keyed preview into real market grouping (multi-country regions, currency zones) without a rewrite — every endpoint's scope resolution already isolates "which countries" from "how they're grouped for display." The same schema is also the trigger to revisit `orders.shipping_address` country-format normalization (currently bridged via `expandCountryScopeForMatching`) with a real `countries` table.
- **Mobile**: wire the 3 missing tracking calls (§9) once there's a way to verify them against a real device/simulator; add the missing consent mechanism to match the web store.
- **Ad attribution**: Acquisition's response shape already reserves room for `spend`/`CPA`/`CAC`/`ROAS` per channel — implementing them means adding a spend-recording surface first (no API integration with Meta/TikTok/Google Ads, per explicit instruction), not changing this phase's attribution model.

---

## Production Review Round 1

**Scope of this round:** a focused security/correctness hardening pass over the ADMIN-2B build above — no redesign, no new dashboards, no database migration. One migration-adjacent, non-schema config change was made (§6) and is called out explicitly since it's the closest thing to an exception to "no migrations" in this round.

### R1.1 Realtime data scoping (CRITICAL) — found and fixed

Audited the complete path: API startup → `websocket.service.ts`'s `register` handler → room membership → `metrics.broadcaster.ts` → `useRealtimeMetrics`/`useRealtimeAlerts` → Real Time tab → Command Center's "Right now" strip.

**Finding:** the Socket.IO `dashboard` room had **no authentication or authorization at all**. Any socket — logged in or not — could `emit('register', {type:'dashboard'})` and be added to the `dashboard` room, which every broadcast method (`broadcastMetrics`, `broadcastAlert`, `broadcastRevenueUpdate`, `broadcastConversionRateUpdate`, `broadcastUserActivity`, etc. — confirmed via a full grep, every one of them targets only `.to('dashboard')`) pushes **global, unscoped** revenue/orders/conversion-rate/alert-counts/visitor-country data into. `analytics.view_market` (the permission a `MARKET_MANAGER` holds) was never checked anywhere in this path — a scoped caller's browser, once connected, received the exact same global stream as `OWNER`/`SUPER_ADMIN`.

**Fix:** added `resolveDashboardAccess(token)` to `websocket.service.ts` — verifies the connecting socket's JWT, then resolves `'global' | 'scoped' | 'denied'` using the same `loadStaffContext()` ACTIVE-membership resolution every REST endpoint already uses (exported from `middleware/staff.ts` for this reuse, not reimplemented). The `register` handler now only `socket.join('dashboard')` when access is `'global'`; a `'scoped'`/`'denied'` caller is told their status via the `registered` event but is **never added to the room**, so they are structurally incapable of receiving a single global metric — not merely prevented from rendering it. This is the smallest fix that closes the hole completely: since every broadcaster already targets only the `dashboard` room, gating room membership at the one connection-time choke point covers every current and future broadcast call site with no other changes needed.

The explicitly-forbidden approach ("receive global websocket data → hide parts of it in React") was not used anywhere — the browser never receives the unauthorized payload in the first place.

**Frontend:** `useRealtimeMetrics()`/`useRealtimeAlerts()` now send the stored JWT as Socket.IO `auth.token` and expose a new `access: 'pending' | 'global' | 'scoped' | 'denied'` field, set from the server's `registered` event. `RealTimeTab.tsx` renders the full metrics grid only when `access === 'global'`; otherwise it shows a `DataQualityNotice` ("Market-scoped realtime metrics are not available yet.") or a loading skeleton while `access === 'pending'` — never a stale "—" forever. Command Center's "Right now" strip and "Live business" (visitors-by-country) section use the identical `access` gate.

**Tests:** `websocket.service.test.ts` (new, 12 tests) covers: no/empty/non-string/forged/expired token → denied; legacy `admin`/`super_admin` → global without ever querying `staff_memberships`; a global (`market_scope IS NULL`) staff membership → global; a `MARKET_MANAGER` with `market_scope: ['CM']` → scoped (not global, not silently denied); a plain customer → denied; SUSPENDED/REVOKED (indistinguishable from "no membership" since `loadStaffContext`'s own query is `WHERE status = 'ACTIVE'`) → denied; empty `market_scope` with no `analytics.view_market` → denied (fails closed); `loadStaffContext` throwing → denied, no crash; a token missing `userId` → denied without a wasted DB call.

### R1.2 Live visitor endpoint (`GET /analytics/visitors/live`)

Confirmed this remains the pre-existing legacy-admin/global-only endpoint from before ADMIN-2B — untouched, no scope logic added to it. Rather than adding a second, parallel scope-resolution mechanism to this REST endpoint, `RealTimeTab.tsx`'s React Query call was changed to `enabled: access === 'global'` — reusing the exact same `access` signal the WebSocket fix above already produces. A `MARKET_MANAGER` now never calls this endpoint at all (no 403 noise, no wasted request), and the live-visitor table is replaced by the same `DataQualityNotice` as the rest of the tab for a scoped caller. No weakening of the endpoint's existing global-only authorization.

### R1.3 Alerts

Re-confirmed `alerts` has no country/market column. `getOperations` (Operations V2) already skipped alert queries entirely for a scoped caller (`if (scope.isGlobal) { ... }`), never issuing `FROM alerts` for a `MARKET_MANAGER` — verified by a test asserting the query is never made. The Realtime path (R1.1) now enforces the identical policy: `activeAlerts`/`alert-triggered`/`alert-acknowledged`/`alert-dismissed` broadcasts all live exclusively in the same `dashboard`-room gate, so a scoped caller receives zero alert data through either surface, not just the REST one.

### R1.4 Mixed-currency revenue safety — found and fixed

**Finding:** every endpoint summing `orders.grand_total`/`payments.amount` (Overview, Sales, Acquisition, Country Performance, Product Intelligence, Operations' payment-failure total) blindly `SUM()`-ed across all matching rows regardless of `orders.currency`/`payments.currency`. Production is EUR-only today, but the column exists specifically because Global Commerce will introduce other currencies, and nothing prevented a future mixed-currency period from being silently summed into one meaningless blended number.

**Policy implemented** (`checkOrderCurrency`/`checkPaymentCurrency`/`getRevenueByCurrency` in `analytics-v2.controller.ts`) — no FX conversion is performed anywhere, by design:

- **Single-aggregate-shaped endpoints** (Overview, Sales, Acquisition) — a whole-response circuit breaker: if the period's orders span more than one currency, the endpoint returns `{ mixedCurrencies: true, currency: null, currencyBreakdown: [{currency, orderCount, revenue}, ...], message }` instead of the normal metrics/trend/channels payload. Chosen because the primary purpose of these three responses **is** the revenue figure — a partially-blanked version would be more misleading than an honest "can't answer this as one number, here's the real breakdown."
- **Multi-row endpoints** (Country Performance, Product Intelligence) — a surgical per-row approach: only the specific country/product whose own orders span multiple currencies gets `revenue: null, currency: null, mixedCurrencies: true, currencyBreakdown: [...]`; every other row is completely unaffected. Product Intelligence additionally keeps `views`/`uniqueVisitors`/`addToCarts`/`currentStock` real even on a mixed-currency product row, since those fields are currency-independent — only `revenue`/`margin` are hidden.
- **Operations** — `paymentFailures.amount` is hidden (`null`) with `currency`/`mixedCurrencies` fields added, using the same per-request currency check, scoped identically to the `paymentFailures` count query itself (an earlier draft of `checkPaymentCurrency` checked currency across *all* failed payments globally regardless of caller scope — corrected to join `orders` and apply the same scope filter as the count query, so a scoped caller's mixed/not-mixed determination reflects only their own market's data).

Which of the two shapes to use per endpoint was decided by response shape, not applied uniformly — matching the review's explicit "choose whichever fits the existing API shape with the least churn."

**Frontend:** `analytics-v2.service.ts`'s response types for Overview/Sales/Acquisition are now real discriminated unions (`OverviewMetricsPayload | MixedCurrencyPayload`, etc. — admin-dashboard runs with `strict: true`, so this narrows correctly, unlike the backend's `strictNullChecks: false`). A new shared `MixedCurrencyNotice` component renders the honest per-currency table; `OverviewTab`/`SalesTab`/`AcquisitionTab`/Command Center render it in place of the normal view when `mixedCurrencies` is true. `ProductsTab`/`OperationsTab` surface the new `dataQuality.currencyNote`; `CountryPerformanceTab`'s revenue column shows "Mixed currencies" instead of a blank/zero for an affected row. A new `formatCurrencyWithCode()` formatter was added since the existing `formatCurrency()` hardcodes EUR, which would mislabel a USD row in a breakdown table.

**Tests:** one mixed-currency test added per touched endpoint (Overview, Sales, Acquisition, Product Intelligence, Operations, Country Performance) — 6 new backend tests, covering both the circuit-breaker and per-row shapes and confirming unaffected rows/fields stay intact.

### R1.5 Timezone model — audited, two real bugs found and fixed, one config gap closed

**How timestamps are stored:** `orders`/`order_items`/`payments`/`cart` use `TIMESTAMP WITH TIME ZONE` (Postgres normalizes to UTC internally regardless of input, and converts back to the session `TimeZone` on read). `user_sessions`/`events_core`/`event_aggregates_hourly`/`alerts` use plain `TIMESTAMP` (**no** time zone) — Postgres stores exactly the wall-clock numbers given and silently discards any offset on insert. This inconsistency is pre-existing schema, not changed here (that would be a migration); its correctness depended entirely on the Node process's own local timezone at the moment `pg` serializes a `Date` parameter for one of the naive columns.

**Gap closed (no migration):** nothing in the codebase pinned either the Node process's or the Postgres session's timezone. `src/index.ts` now sets `process.env.TZ = process.env.TZ || 'UTC'` before any other module runs, and `src/config/database.ts`'s pool config now sets `options: '-c TimeZone=UTC'`, pinning every DB session's `TimeZone` GUC regardless of server/OS default. Together these make `NOW()`/`CURRENT_TIMESTAMP`, every `DATE(created_at)`/`DATE(event_time)` bucket used by Sales' and Search & Demand's trend charts, and every write to a naive-timestamp column deterministically UTC — verified concretely, not assumed: this development sandbox's own OS default is `Europe/Rome` (confirmed via `Intl.DateTimeFormat().resolvedOptions().timeZone`), so the pre-fix code was demonstrably exposed to this exact risk, not a theoretical one.

**Bug 1 — "Today"/"Yesterday" always returned zero rows.** The admin dashboard's date presets (`useAnalyticsFilters.ts`'s `isoDate()`) send bare `YYYY-MM-DD` strings for both `from` and `to`; for a single-day preset these are identical. `new Date('2026-08-10')` parses to UTC midnight — the *start* of that day. Every query uses an exclusive upper bound (`created_at < to`), so `from === to` produced `WHERE created_at >= X AND created_at < X`, which is mathematically impossible to match: **the Today and Yesterday presets could never show any data, regardless of what was in the database.** Fixed in `parseDateRangeParams`: a bare-date `to` (and `compareTo`) is now advanced by one day, so it means "through the end of that UTC day" — matching what a human typing "to: Aug 10" obviously intends, and incidentally also fixing a smaller pre-existing issue where a date-only `to` in a *multi-day* custom range excluded that final day entirely.

**Bug 2 — `previous_year` comparison used local Date getters.** `compare.from`/`compare.to` were built with `new Date(to.getFullYear(), to.getMonth(), to.getDate(), ...)` — `getFullYear`/`getMonth`/`getDate`/`getHours` are **local-timezone** getters, mixed with otherwise-UTC-parsed date boundaries. Once the Node process isn't running in UTC (true today, per the sandbox above), this silently shifts the previous-year comparison range by the local UTC offset. Fixed to use `Date.UTC(...)`/`getUTCFullYear()` etc., matching the rest of the date-range model.

**Tests:** 5 new tests in `analytics-query.helpers.test.ts` — a single-day range spans a full 24h window (not zero-width); a date-only `to` in a multi-day range includes that whole day; a full datetime `to` (has a time component) is left untouched; the same end-of-day fix applies to an explicit `compareTo`; `previous_year` produces exact, TZ-independent UTC boundaries.

**What "Today"/"custom range" mean today:** UTC calendar day, computed from the browser's current UTC instant (`toISOString().slice(0,10)`) — **not** the viewing staff member's local calendar day. A France- or Cameroon-based staff member near local midnight could see "Today" roll over at a different wall-clock moment than they'd expect. Documented here as a known, self-consistent behavior (frontend generates UTC-anchored date strings, backend parses them as UTC) rather than a bug — a real per-viewer-timezone "Today" would be a deliberate future feature, not a fix, and the review's own instructions were explicit not to build a full per-user timezone system unless necessary.

### R1.6 Test count reconciliation

Real `npx jest` output, tech-tools-api, run at the end of this round: **23 test suites, 215 tests, all passing.** Breakdown against the ADMIN-2B baseline this report already recorded (§12: 22 suites / 192 tests):

| Change this round | Suites | Tests |
|---|---|---|
| ADMIN-2B baseline (§12, unchanged) | 22 | 192 |
| `websocket.service.test.ts` (new file, R1.1) | +1 | +12 |
| `analytics-v2.controller.test.ts` (mixed-currency cases, R1.4) | — | +6 |
| `analytics-query.helpers.test.ts` (date-range cases, R1.5) | — | +5 |
| **Total, confirmed by real `npx jest` output** | **23** | **215** |

`npx tsc --noEmit` and `npm run build` both clean.

### R1.7 Frontend production smoke-test matrix

admin-dashboard has no automated frontend test runner (unchanged from ADMIN-2B §12/§13 — not newly installed for this review, per the review's own instruction). The following is a manual browser checklist for whoever performs the actual production smoke test after deployment.

**As GLOBAL (`SUPER_ADMIN`/legacy admin):**
- [ ] `/dashboard/analytics` loads; all 9 tabs (Overview, Real Time, Sales, Funnel, Products, Search & Demand, Acquisition, Operations, Country Performance) render without a console error.
- [ ] Changing the date range (including switching to "Today" and "Yesterday" specifically — R1.5's fix) updates every tab's numbers; an empty/no-data period renders zero states, not a crash.
- [ ] Real Time tab shows the live metrics grid (not a "market-scoped" or "not available" notice) and the live-visitors table populates.
- [ ] Command Center's "Right now" strip shows real numbers (not perpetually pending/skeleton) and "Live business" (visitors by country) renders.
- [ ] CSV export works on Sales/Products/Acquisition/Country Performance and the downloaded file matches what's on screen.
- [ ] If the current period's orders span more than one currency (won't be true in EUR-only production today, but verify the code path if ever tested against multi-currency seed data): Overview/Sales/Acquisition show the `MixedCurrencyNotice` breakdown table instead of the normal view; Product Intelligence and Country Performance show per-row "hidden" revenue only where actually mixed.

**As MARKET_MANAGER (`market_scope: ['CM']` or similar):**
- [ ] `/dashboard/analytics` route is reachable (not blocked by `RequirePagePermission`).
- [ ] Every tab's data reflects only the caller's own market — no other country's totals, breakdowns, or names appear anywhere (network tab: inspect the actual JSON response, not just what's rendered).
- [ ] Country Performance never shows a country outside `market_scope`.
- [ ] Operations shows no alerts section (an `EmptyState`/note instead), and the network tab confirms no `GET`-adjacent alerts query fired.
- [ ] Real Time tab shows the `DataQualityNotice` ("Market-scoped realtime metrics are not available yet"), never the global metrics grid, and the live-visitors table/section does not render at all.
- [ ] Command Center's "Right now" strip and "Live business" section both show the same notice/omission, never global numbers.
- [ ] Browser DevTools → Network → WS: inspect the `registered` Socket.IO event payload directly and confirm `access: "scoped"` — and confirm no `metrics-update`/`revenue-update`/`alert-*` events ever arrive on that socket.

**Edge cases (any role):**
- [ ] A staff member with `market_scope: []` (explicitly empty, not null) sees the same "no data" fail-closed behavior as a normal scoped caller with an unmatched country — never global data.
- [ ] A `SUSPENDED` or `REVOKED` staff membership is treated as "no staff context" everywhere (fails closed, matching `loadStaffContext`'s `ACTIVE`-only query) — Analytics route access and the WebSocket `access` value both reflect this identically to a plain customer.

### R1.8 API response security review

Manually re-read every V2 endpoint's actual response-construction code (not just the frontend's rendering of it) for accidental leakage — `getOverview`, `getSales`, `getFunnel`, `getProductIntelligence`, `getSearchDemand`, `getAcquisition`, `getOperations`, `getCountryPerformance`. In every case, the scope filter (`orderCountryScopeFilter`/`sessionCountryScopeFilter`, both failing closed to `AND 1 = 0` on an empty scoped country list) is applied **inside the SQL** feeding every row of the response — not fetched globally and filtered in JS afterward, and not merely omitted from what the frontend renders. Confirmed no endpoint's response object contains an out-of-scope country breakdown, a global total alongside a scoped one, a global product-analytics row, an out-of-scope campaign/search term, or supplier information a scoped caller shouldn't see. The one field that is intentionally global regardless of caller scope is the product **catalog** itself (name/SKU/price/stock in Product Intelligence) — consistent with this codebase's existing access model, where `market_scope` restricts order/customer/session data by country, not the product catalog, which isn't itself market-specific. No leakage found; no code change was needed for this item — R1.1 (realtime) and R1.4 (currency) were the two real defects this round surfaced, both already covered above.

### R1.9 Performance sanity check

No index migration was added (explicit instruction: no speculative indexing without a real query-plan/volume signal). Reviewed the current index set against every ADMIN-2B query shape:

- **`orders.created_at` has no index at all** — every Overview/Sales/Acquisition/Country-Performance/Product-Intelligence/Operations query filters on it. Pre-existing gap (the original `analytics.controller.ts` endpoints already scan this column unindexed), not introduced this phase. Flagged again here as the single highest-value future index once real production volume justifies it.
- **`orders.shipping_address->>'country'`** (used by every `orderCountryScopeFilter` call) has no GIN/expression index — a scoped caller's order queries filter on an un-indexed JSONB expression. Same status: pre-existing, documented, not added.
- **`payments`** has no index on `(status, created_at)` or on `order_id` — `checkPaymentCurrency`/Operations' `paymentFailures` query join `payments` to `orders` and filter `status = 'failed'` over a date range with neither indexed.
- **`order_items.product_id`** has no index — Product Intelligence's and Search & Demand's `purchase_stats` CTEs `GROUP BY oi.product_id` over `order_items` joined to a date-filtered `orders`.
- **`events_core`/`user_sessions`** are comparatively well-indexed already (`event_time`, `event_type`, `session_id`, composite `(event_time DESC, source)`/`(user_id, event_time DESC)` on `events_core`; `start_time`, `country_code` (added in migration 037), `session_id` on `user_sessions`) — no new gap found there this round.
- **`event_aggregates_hourly` remains unpopulated and unused**, as documented in the original report (§8) — continuing to query raw `events_core` is correct, not a regression to "fix."
- Nothing in this round changed a query's fundamental shape (join order, filter placement) in a way that would newly risk a sequential scan that wasn't already a risk before — the mixed-currency and country-performance changes added `GROUP BY ..., o.currency`/an extra `DISTINCT` query per request, which is a small, bounded addition (one extra indexed-by-nothing-worse-than-before scan), not a new class of expensive query.

All of the above are documented as future optimization candidates, consistent with "no speculative index migration" — none block production deployment at current data volume.

### R1.10 Quality gates (Production Review Round 1)

**tech-tools-api:** `npx tsc --noEmit` — clean. `npx jest` — **23 suites, 215 tests, all passing** (§R1.6). `npm run build` (`tsc`) — clean.

**admin-dashboard:** `npx tsc --noEmit` — clean. `npm run lint` (`eslint`) — zero errors/warnings in every file touched this round (`analytics-v2.service.ts`, `MixedCurrencyNotice.tsx`, `format.ts`, `OverviewTab.tsx`, `SalesTab.tsx`, `AcquisitionTab.tsx`, `ProductsTab.tsx`, `OperationsTab.tsx`, `CountryPerformanceTab.tsx`, `command-center/page.tsx`); the pre-existing 235 errors/128 warnings elsewhere in the codebase (mostly `@typescript-eslint/no-explicit-any` in `services/*.service.ts` and `types/generated.ts`) predate this round and this phase, confirmed unrelated by filename. `NODE_OPTIONS="--max-old-space-size=3072" npm run build` — clean, all 38 routes compiled (the memory flag is a known constraint of this sandbox's ~3.8GB RAM, not a code issue — see ADMIN-2A.5's report for the same note).

### R1.11 Remaining risks (not fixed, explicitly out of scope this round)

- **`orders.created_at`/`shipping_address`/`payments`/`order_items.product_id` indexing** (§R1.9) — documented, not migrated.
- **No frontend automated tests** — unchanged from ADMIN-2B §13; R1.7's manual checklist is the mitigation for this round specifically.
- **UTC-vs-local-viewer "Today" semantics** (§R1.5) — intentional, documented, not built into a per-user timezone system.
- **`user_sessions`/`events_core`/`event_aggregates_hourly`/`alerts` remain naive `TIMESTAMP` columns** (not `TIMESTAMPTZ`) — the process/session TZ pins (§R1.5) close the practical risk without a migration, but the schema-level inconsistency with `orders`/`payments` (which are `TIMESTAMPTZ`) is still there for a future migration to clean up.
- **Mobile checkout/search instrumentation gap and missing mobile consent mechanism** — unchanged from ADMIN-2B §9, out of scope for a backend/admin-dashboard hardening round.

---

## ANALYTICS: READY FOR PRODUCTION DEPLOYMENT

ADMIN-2B shipped a working, tested, honestly-documented Analytics 2.0 workspace. This Production Review Round 1 pass found and fixed one critical issue (realtime data was not scoped at all — now fully gated at connection time, verified by 12 new tests) and one correctness issue with production-scale implications (mixed-currency revenue was never guarded against — now policy-enforced per endpoint, verified by 6 new tests), plus two real timezone bugs (a "Today"/"Yesterday" query that could never return data, and a local-timezone-dependent previous-year comparison — both fixed, verified by 5 new tests, and closed at the config level with no database migration). A full response-payload audit found no further scoped-data leakage. Performance and indexing gaps were investigated and documented, not spuriously migrated. All quality gates pass: tech-tools-api (23 suites / 215 tests, clean `tsc`, clean build) and admin-dashboard (clean `tsc`, clean lint on every touched file, clean production build). No database migration, no deployment, and no Global Commerce/localization work was performed — all remain the founder's own next action.
