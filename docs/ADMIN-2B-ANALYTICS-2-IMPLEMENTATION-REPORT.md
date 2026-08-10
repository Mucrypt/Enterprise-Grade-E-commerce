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

## ANALYTICS: READY FOR PRODUCTION REVIEW

The shell, all 8 explicitly-required tabs (Overview, Real Time, Sales, Funnel, Products, Acquisition, Search & Demand, Operations, Country Performance), and the reusable filter/data-quality system are implemented, tested (62 new backend tests, 192/192 total passing), and documented — including honest limitations rather than fabricated coverage (mobile funnel gap, refund-rate unavailability, margin coverage, alerts' lack of market scoping, no ad-spend data). No existing analytics engine, event table, or Global Commerce/staff schema was replaced or altered. No employee was granted access as part of this phase. Deployment and migrations remain the founder's own action, not performed here.
