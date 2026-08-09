# Admin Platform 2.0 — Roadmap

**Status: design + foundation.** `ADMIN-2A` (staff foundation, Organization UI, permission-aware navigation, Command Center shell) is implemented — see `docs/041-STAFF-MEMBERSHIPS-IMPLEMENTATION-REPORT.md`. Everything else in this document is design for `ADMIN-2B` through `ADMIN-2D`, not built yet, per the explicit instruction not to build every Analytics 2.0 screen in this phase.

---

## 1. Current UI audit

Inspected directly (not assumed) before writing this:

- **Navigation** (`admin-dashboard/components/layout/Sidebar.tsx`): a flat-ish list of ~13 top-level items, some with children (Products, Blog, Sales, Communication, Marketing) — Dashboard, Products, Books, Sellers, Media Library, Blog, Trending, Sales (Orders/Customers/Shipping), Communication (AI Hub/Email/WhatsApp/Newsletter/Contact), Marketing (Promotions/Coupons), Analytics, Admins, Settings. No grouping above the item level — no "Commerce"/"Operations"/"Growth" workspace concept exists today.
- **Auth surface**: no navigation is permission-aware today — every logged-in `admin`/`super_admin` sees the identical sidebar (confirmed: the array is static, filtered by nothing). `041` is the first thing to change that (Settings + the new Organization entry).
- **Existing real-time infrastructure**: `hooks/useRealtimeMetrics.ts` already streams `activeUsers`, `eventsPerSecond`, `lastHourRevenue`, `lastHourOrders`, `conversionRate`, `activeAlerts` (by severity), `topCountries` via Socket.IO from the API's `metrics.broadcaster.ts` worker — this is a real, working foundation, not a gap. The Command Center shell (`ADMIN-2A`) already uses it directly.
- **Existing Analytics page** (`/dashboard/analytics`) already has real infrastructure per the phase brief: live visitors, country, device, source, referrer, page views, revenue, AOV, conversion, checkout abandonment, revenue trend, funnel, top products, channel attribution — backed by `events_core`/`user_sessions`/`event_aggregates_hourly` (confirmed present and populated, per the LAUNCH-FOUNDATION-1 analytics audit). This is the system `ADMIN-2B` extends, not replaces.
- **Existing legacy Admins page** (`/dashboard/admins`) manages `users.user_type IN ('admin','super_admin')` accounts directly — kept as-is; the new Organization/Staff area (`/organization/staff`) is additive, not a replacement.
- **Design system**: shadcn/ui primitives already in use throughout (`components/ui/*` — Card, Table, Dialog, Sheet, Select, Badge, Skeleton, etc.), Tailwind, `lucide-react` icons, `sonner` toasts, TanStack Query for data fetching. `ADMIN-2A` added `MetricCard`, `AttentionCard`, `EmptyState`, `PermissionGate` on top of this — not a new design system, an extension of the existing one.
- **Two parallel client-side auth stores found** (not created by this phase, flagged not fixed): `contexts/AuthContext.tsx` (actively used, now staff-aware per `041`) and a separate `lib/auth-store.ts` (Zustand, used only by `books/page.tsx` and `sellers/page.tsx`). Left alone deliberately — reconciling them risks breaking those two pages for a cosmetic consistency win, not this phase's job.

---

## 2. Information architecture

The full target structure from the phase brief, annotated with what exists today vs. what's proposed:

```
OVERVIEW
├── Command Center        [ADMIN-2A: shell shipped at /command-center]
├── My Work                [ADMIN-2C: role-aware, not built]
└── Alerts                 [exists: activeAlerts in Command Center + /dashboard/analytics;
                             a dedicated Alerts list view is a small ADMIN-2C addition]

COMMERCE
├── Orders                 [exists: /dashboard/orders]
├── Customers               [exists: /dashboard/customers]
├── Products / Categories / Collections / Brands   [exist today, ungrouped]

OPERATIONS
├── Inventory                [no dedicated page yet -- inventory is currently only
                               visible embedded in the Products pages]
├── Suppliers                [exists: /suppliers]
├── Shipping                 [exists: /dashboard/shipping]
├── Fulfilment                [does not exist -- depends on GLOBAL-COMMERCE-3's
                               fulfillment_locations/product_fulfillment_options]
└── Returns / Exceptions      [does not exist -- proposed ADMIN-2C]

GROWTH
├── Analytics                 [exists, real -- extended in ADMIN-2B, not replaced]
├── Marketing / Campaigns      [exist today as "Marketing" with Promotions/Coupons children]
├── Email / Newsletter / WhatsApp   [exist today under "Communication"]

CONTENT
├── Blog                      [exists]
├── Media Library               [exists]
├── Books                       [exists]
└── AI Hub                       [exists, under "Communication" today]

MARKETPLACE
└── Sellers                     [exists: /sellers]

INTERNATIONAL                    [ADMIN-2D -- explicitly after Global Commerce schema exists]
├── Markets / Countries / Pricing / Availability / Fulfilment / Payment capability

ORGANIZATION
├── Staff                     [ADMIN-2A: shipped, /organization/staff]
├── Roles                      [permission matrix is currently code-only and correct
                                 per the original audit's anti-decorative-table lesson --
                                 a "Roles" screen would just be a read-only view of
                                 config/staff-permissions.config.ts, low priority]
└── Audit Log                  [per-membership: shipped in the Staff detail Sheet.
                                 A global cross-organization feed is ADMIN-2C]

SYSTEM
├── Store Settings              [exists: /dashboard/settings -- now permission-gated]
├── Security / Integrations / Payments / Developer   [exist today folded into Settings;
                                 splitting them into their own pages is a low-urgency
                                 ADMIN-2C/D cleanup, not before real staff exist to need it]
```

**Deliberate decision: no full sidebar reorganization into these top-level groups this phase.** Every existing link keeps working exactly where it is; only two things changed (`Settings` gated, `Organization → Staff` added). Reorganizing ~25 existing links into 9 new groups is real UI-risk surface for zero functional gain until there are actual role-specific users who'd benefit from the grouping — done incrementally as `ADMIN-2C`'s role-specific homes make the grouping's value concrete, not speculatively now.

---

## 3. Role-specific dashboards (design, `ADMIN-2C`)

Each home screen below reuses the `MetricCard`/`AttentionCard`/`EmptyState` components already built in `ADMIN-2A` — this is a data-source and layout problem, not a new component problem.

| Role | Home shows | Backing data |
|---|---|---|
| `SUPPORT_AGENT` | Open tickets, customers awaiting reply, recent orders needing communication, SLA/response metrics | Needs a support-ticket aggregation query -- the existing contact/support schema has the raw data, no rollup endpoint yet |
| `ORDER_MANAGER` | Orders awaiting processing, payment exceptions, shipping exceptions, cancellation requests, fulfilment status | `orders`/`payments`/`shipping_labels` already have the raw state; needs one new aggregated `GET /dashboard/order-manager-summary`-style endpoint |
| `CATALOG_MANAGER` | Products needing review, missing inventory, supplier import issues, low margins, inactive products, search demand gaps | Mostly available today (`inventory`, `supplier_import_batches`, `product_unit_economics`) — needs a summary endpoint, not new data |
| `MARKETING_MANAGER` | Traffic, campaigns, conversion, coupon performance, email/newsletter, top landing pages, search demand | `events_core`/`user_sessions`/`coupon_usage`/newsletter tables already exist |
| `MARKET_MANAGER` | Market visitors, market orders, market customers, market inventory, market suppliers, market campaigns, market support | Every panel here needs `applyMarketScope()` (shipped, unwired) applied to each underlying query -- the single biggest concrete `ADMIN-2C` piece of work |
| `OWNER`/`SUPER_ADMIN`/`ADMIN` | The full Command Center (global, unscoped) | Shipped in `ADMIN-2A` |

**Routing approach (not built yet):** a single `/command-center` route that renders a different panel set based on `useStaffAccess()`'s resolved role, rather than N separate pages — avoids duplicating the shell/layout across six near-identical pages.

---

## 4. Command Center design

Shipped in `ADMIN-2A` (`admin-dashboard/app/(dashboard)/command-center/page.tsx`) as the shell; this section is what it grows into.

**Shipped now, real data:** Business Pulse (revenue/orders/conversion/active-visitors, from `useRealtimeMetrics`), Needs Attention → Active alerts (from the same hook's `activeAlerts`, which only exists because `040` repaired the `alerts` table this phase depended on), Live Business → visitors by country.

**Explicitly placeholder now, real in later phases, never faked:** Needs Attention → Operational queues (orders/payments/shipping/stock exceptions — needs new aggregation endpoints, `ADMIN-2C`), Market Performance (needs `GLOBAL-COMMERCE` countries/markets, `ADMIN-2D`), My Work (needs role-specific data sources, `ADMIN-2C`), Recent Activity (needs a global cross-membership audit feed — today's `staff_audit_log` API is per-membership only, `ADMIN-2C`).

**Design rule carried through every phase:** an `EmptyState` naming which phase wires a panel up is always preferred over a fabricated number. This was enforced in `ADMIN-2A`'s own build (`components/dashboard/EmptyState.tsx`, used for every not-yet-real panel) and should hold for every future addition.

---

## 5. Analytics 2.0 architecture (design, `ADMIN-2B`)

Explicitly not replacing the existing analytics engine — same `events_core`/`user_sessions`/`event_aggregates_hourly`/UTM attribution/`orders`/`payments` tables, reorganized into the phase brief's workspace tabs:

1. **Overview** — today's `/dashboard/analytics` content, effectively renamed/kept.
2. **Real Time** — extends the existing real-time screen with: landing page, current page, campaign, device/browser, cart/checkout state (event-derived only — `add_to_cart`/`checkout_start` events already exist, no new instrumentation). Explicitly excludes session recording, keystroke capture, form/password capture, or DOM surveillance, per the phase brief.
3. **Sales** — revenue/AOV/order trends, already substantially present.
4. **Funnel** — Sessions → Product View → Add to Cart → Checkout Start → Payment Success, with per-stage counts, conversion %, drop-off %, filterable by date/country/device/source/campaign/product/category. **Reuses existing event types only** — per the LAUNCH-FOUNDATION-1 analytics audit, mobile doesn't yet fire `checkout_start`/`payment_success` from all the right call sites, so this workspace must clearly label mobile funnel data as partial until that gap (already flagged, not yet fixed) closes — never silently show an incomplete funnel as complete.
5. **Products** — per-product views/ATC/checkout/purchases/revenue/conversion/refund rate/stock/margin/traffic source/country demand/trend, per the phase brief. Margin and country-demand panels only render where the underlying data is actually trustworthy (`product_unit_economics` for margin; `events_core` + `user_sessions.country_code` join for demand) — never fabricated for products lacking that data.
6. **Customers** — cohort/LTV-style views; scoped by `customers.view_pii` for anything beyond order-linked aggregate counts.
7. **Acquisition** — source/medium/campaign/content/term → sessions/views/ATC/checkout/orders/revenue/conversion, from the existing UTM system (already the source of truth, per the phase brief — no Meta/TikTok/Google integration this phase or the next).
8. **Search & Demand** — top searches, zero-result searches, searches by country, products viewed-but-unavailable, high-view/low-conversion products, high-cart/low-purchase products. This is the "what should we source next" view the phase brief calls out as important for purchasing — genuinely new aggregation work, not a relabeling of something that exists.
9. **Markets** — deferred to `ADMIN-2D`, same reasoning as Command Center's Market Performance panel.
10. **Operations** — anomaly/alert history (the repaired `alerts` table), supplier import failure rates, fulfilment exceptions.
11. **Reports** — exportable/scheduled views of the above; lowest priority, last to build.

**None of workspaces 4-8 are built this phase** — this section is the plan Part Z's deliverable list explicitly asked for instead of the screens themselves.

---

## 6. Reusable design-system components

**Shipped in `ADMIN-2A`:** `MetricCard`, `AttentionCard`, `EmptyState`, `PermissionGate`.

**Proposed for `ADMIN-2B`/`2C`, not built:** `TrendMetric` (a `MetricCard` variant with a sparkline, once a charting library decision is made — none is in `package.json` today, worth deciding once Analytics 2.0 actually needs one rather than picking speculatively), `DataTable` (a `Table` wrapper adding sort/pagination/column-filter conventions, worth extracting once 2-3 real screens duplicate that logic, not before), `FilterBar`, `DateRangePicker`, `MarketSelector` (the `OWNER`/`SUPER_ADMIN`-only "view as market X" control), `ActivityTimeline` (powers both the global Recent Activity feed and the per-staff audit view — the per-staff version already exists inline in the Staff Sheet; extracting it into a shared component is worth doing exactly when the global feed is built, so the extraction is informed by two real call sites, not one guessed one), `ChartCard`, `CommandPalette` (explicitly "later if useful" per the brief — no evidence yet it's needed).

**Requirements carried forward for every future component, not just the ones already shipped:** responsive, accessible, dense (not oversized marketing UI), consistent spacing/typography, skeleton loading states, useful empty *and* error states, no fabricated data ever.

---

## 7. API aggregation strategy

**Problem being designed against:** the phase brief explicitly warns against one-API-request-per-card, page-level waterfalls, and fetching global datasets client-side to filter in the browser. None of that pattern exists in what shipped this phase (`GET /staff` is already paginated and server-filtered by status/role; the Command Center's real panels come from a single `useRealtimeMetrics` WebSocket subscription, not N REST calls).

**For `ADMIN-2B`/`2C`:** each dashboard workspace/home screen should be backed by one aggregated endpoint returning everything that screen needs in one round trip (e.g. a single `GET /dashboard/order-manager-summary` rather than five separate list calls the frontend combines), following the same shape `getMyStaffContext`/`GET /staff/me` already established. Market-scoped versions of these endpoints apply `applyMarketScope()` server-side — the frontend never fetches globally and filters client-side by market, which would both leak data across scope and violate the "server-side filtering" requirement directly.

**Pagination:** offset-based (`page`/`limit`) is what `GET /staff` uses today, consistent with every other existing list endpoint in this codebase (`getProducts`, `getActiveAlerts`, etc.) — no reason to introduce cursor pagination for consistency's sake alone; worth revisiting only for a genuinely high-volume feed (e.g. the future global activity log) where offset pagination's performance characteristics would actually matter.

---

## 8. Realtime strategy

**Existing, reused, not rebuilt:** the Socket.IO `metrics.broadcaster.ts` → `useRealtimeMetrics` pipeline, already broadcasting every 30 seconds per its own header comment. `ADMIN-2A`'s Command Center is the first consumer of `activeAlerts` from this pipeline outside the original dashboard.

**Rule going forward, matching the phase brief's explicit "realtime ≠ every page polling every second":** only panels that are genuinely about *right now* (active visitors, live alerts, live order/checkout events) use the WebSocket subscription. Everything else (funnel, product analytics, acquisition reports) uses normal React Query fetches with sensible `staleTime` (the existing `QueryClientProvider` default is 60 seconds, already reasonable) and manual/interval refetch only where a screen's own purpose demands it — not a blanket "make everything live" policy.

---

## 9. Permissions mapping

Full matrix lives in `docs/041-STAFF-MEMBERSHIPS-IMPLEMENTATION-REPORT.md` (the single source of truth — not duplicated here to avoid the two documents drifting apart). The mapping this roadmap adds is IA-to-permission, for when each future page is actually built:

| IA section | Primary permission(s) |
|---|---|
| Command Center (global) | `dashboard.view` (Business Pulse), `analytics.view_global` (org-wide panels) |
| Command Center (market-scoped) | `dashboard.view` + `analytics.view_market`, filtered via `applyMarketScope` |
| Orders | `orders.view` / `orders.manage` / `orders.cancel` / `orders.refund` |
| Customers | `customers.view` / `customers.manage` / `customers.view_pii` |
| Products/Catalog | `catalog.view` / `catalog.manage` / `catalog.publish` |
| Inventory | `inventory.view` / `inventory.manage` |
| Suppliers | `suppliers.view` / `suppliers.manage` / `suppliers.import` |
| Shipping/Fulfilment | `shipping.view` / `shipping.manage` |
| Marketing/Campaigns | `marketing.view` / `marketing.manage`, `campaigns.view` / `campaigns.manage` |
| Support | `support.view` / `support.manage` |
| Organization/Staff | `staff.view` / `staff.manage` / `staff.grant` / `staff.revoke` |
| Settings/Security/Payments | `settings.*` / `security.*` / `payments.*` |
| International (future) | new permissions to be defined alongside `GLOBAL-COMMERCE-1A`, not guessed at now |

---

## 10. Phased build plan

Matches the phase brief's Part Y exactly, with what's actually done marked:

- **`ADMIN-2A` — done, this phase:** staff foundation (schema/API/tests), Organization/Staff UI, role-aware navigation (`PermissionGate`, filtered sidebar), Command Center shell.
- **`ADMIN-2B` — not started:** Analytics 2.0 workspaces (§5 above) — Real Time, Funnel, Products, Acquisition, Search & Demand, built on the existing, unreplaced analytics engine.
- **`ADMIN-2C` — not started:** role-specific home screens (§3), operational attention-queue aggregation endpoints, global cross-organization audit/activity feed, `applyMarketScope` wired into real `orders`/`suppliers` controllers.
- **`ADMIN-2D` — not started, explicitly blocked on `GLOBAL-COMMERCE-1A`+ landing first:** International admin section (Markets/Countries/Pricing/Availability/Fulfilment/Payment capability), Market Performance panel on the Command Center, per-market Analytics tab.

Each phase is independently testable and shippable — `ADMIN-2B` doesn't require `ADMIN-2C`, `ADMIN-2C`'s role-specific homes don't require International, etc., matching the phase brief's explicit requirement.

---

## 11. Pages that will change

| Page | This phase (`ADMIN-2A`) | Future |
|---|---|---|
| `components/layout/Sidebar.tsx` | Settings gated; Organization → Staff and Command Center links added | Full IA regrouping, if/when it's worth the risk — not planned as a single big-bang change |
| `app/(dashboard)/dashboard/settings/...` | Now requires `settings.view` | Split into Security/Integrations/Payments/Developer sub-pages, `ADMIN-2C`/D |
| `app/(dashboard)/dashboard/admins/...` | Unchanged | Unchanged — stays the legacy `user_type`-based admin list indefinitely |
| **New:** `app/(dashboard)/organization/staff/page.tsx` | Built | Role/Audit-log dedicated sub-pages if the combined Sheet view stops being enough |
| **New:** `app/(dashboard)/command-center/page.tsx` | Built as shell | Gains role-specific rendering (`ADMIN-2C`), Market Performance (`ADMIN-2D`) |
| `app/(dashboard)/dashboard/analytics/...` | Unchanged | Reorganized into the 11-tab workspace structure, `ADMIN-2B` |
| Every other existing page | Unchanged | Individually reviewed for permission-gating as `ADMIN-2C` role homes make specific gaps concrete, not speculatively |

No screenshots are included in this document — the pages named above are the existing, already-deployed admin-dashboard pages, unchanged except where explicitly noted.
