# Market Ops Dashboard — Design-Only Proposal

**Status:** Design proposal only. Nothing in this document has been built. No new tables, endpoints, or UI were created as part of this phase.
**Depends on:** [`docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md`](./MARKET-OPS-STAFF-ACCESS-AUDIT.md) for the `staff_memberships`/market-scoping model this dashboard would sit behind, and the analytics audit in `docs/LAUNCH-FOUNDATION-1-REPORT.md` for what event data already exists and is trustworthy today.

## Goal

Give a future Market Manager (the planned Cameroon manager first) a real-time, privacy-safe view of what's happening in their market — visitors, searches, cart activity, orders, support load — without building session recording, keystroke logging, or anything that captures more than a business needs to operate.

## Reuse, don't rebuild

The repository already has first-party tracking infrastructure that is largely working (see the analytics audit): `events_core` (every tracked event: `product_view`, `search`, `add_to_cart`, `checkout_start`, `payment_success`, etc. — full enum in `tech-tools-api/src/database/migrations/026_unified_analytics_schema.sql:8-27`), `user_sessions` (session/device/UTM plus `country_code`/`country_name`/`city` added by `037_live_visitor_analytics.sql`, and an indexed `last_activity_time` column already shaped for a "who's online now" query), and `event_aggregates_hourly` for rollups. This proposal is a new **view** over that existing data, scoped by market — not a new analytics pipeline.

## Proposed information surfaces

All of the following are derivable from `events_core` + `user_sessions` as they exist today, filtered by `user_sessions.country_code` (or `orders.shipping_address->>'country'` for order-stage data) once the market-scoping filter from the staff-access design is wired in:

- **Live activity**: active visitors right now (via `user_sessions.last_activity_time` within a short rolling window), by country/traffic source/campaign.
- **Discovery**: product views, searches performed, **zero-result searches** (a `search` event whose result count was 0 — needs a `result_count` field on the search event payload if not already present; worth confirming before building), category views, filter usage.
- **Cart & checkout funnel**: add-to-cart, checkout started, checkout abandoned (already distinct event types in the enum), successful orders — a straightforward funnel view (visits → product view → add to cart → checkout start → purchase) using existing event types, no new instrumentation required except closing the mobile gaps noted below.
- **Orders**: order status, top products by units/revenue, scoped to the market's orders.
- **Support**: open/recent support tickets or contact submissions for the market (existing `contact`/support schema, scoped by customer country or explicit market tag if one exists on the ticket).
- **Conversion**: visits-to-purchase rate, computed from the funnel above, not a new metric type.

## Explicit non-goals — never collect

- Passwords, password reset tokens, or any authentication secret.
- Payment card fields, full card numbers, CVV, or any raw Stripe payment method data (Stripe already tokenizes this; the app itself never sees raw card data today and this proposal does not change that).
- Full keystroke logging, mouse/session replay recording, or DOM-mutation capture of any kind.
- Free-text form contents beyond what's operationally necessary (e.g. capture that a support ticket was opened and its category/status, not necessarily archive the full message body into an analytics event separate from the actual support ticket record it already lives in).
- Anything not already covered by the existing consent gate on web (`hasAnalyticsConsent()` in `e-commerce-web-store/src/services/event-tracking.ts`) — this dashboard must never become a reason to loosen or bypass consent, and per the audit, mobile currently has **no consent gate at all**; that gap should be closed as part of building this, not worked around.

## Market scoping

A Cameroon Market Manager's view filters every panel above to `country_code = 'CM'` (or the order-address equivalent), using the same `market_scope` mechanism proposed for `staff_memberships` — this dashboard is the primary consumer that mechanism was designed for. A global/`OWNER`/`SUPER_ADMIN` view has no filter applied.

## Known gaps to close before this is fully trustworthy (from the analytics audit)

These aren't new work invented by this proposal — they're pre-existing gaps this dashboard would inherit and should not be built on top of silently:

1. **Mobile has no consent gate.** Must be added before mobile events feed a dashboard a market manager relies on for real decisions.
2. **Mobile never actually calls `trackSearch`, `trackCheckoutStart`, or `trackPaymentSuccess`** from `search.tsx`, `checkout.tsx`, or the cart screen, even though the tracking service supports them — the mobile side of the funnel view above would be incomplete until these call sites are added.
3. **The backend batch-insert endpoint silently swallows invalid events** (`tech-tools-api/src/api/v1/analytics/analytics.controller.ts:512-545` — a per-event try/catch that only logs a warning, still returns `200`). A dashboard built on this data should not assume 100% capture without this being tightened or at least monitored.
4. **UTM/campaign data is not attached to orders/payments**, only to `user_sessions` — a "revenue by campaign" panel is not currently possible without that link existing somewhere.

## Suggested build order (not part of this phase)

1. Close the mobile consent gap and the three missing mobile call sites (items 1–2 above) — data-quality prerequisites, small and isolated.
2. Add the market-scope filter (from the staff-access design) to a read-only analytics query layer.
3. Build the live-activity and funnel panels first (cheapest, highest signal, fully supported by existing schema).
4. Add zero-result-search tracking if `result_count` isn't already captured on the `search` event.
5. Support/ticket panel last — lowest urgency, and depends on whatever market-tagging (or country inference) the support/contact schema ends up using.

This ordering intentionally defers any UI work until the market-scoping mechanism it depends on exists — building the dashboard before `staff_memberships` would mean building it against `admin`/`super_admin`-only access, which is exactly the unscoped access this whole initiative exists to avoid.
