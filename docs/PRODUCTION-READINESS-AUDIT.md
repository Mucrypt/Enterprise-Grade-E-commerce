# Production Readiness Audit

**Project:** TechTools Enterprise E-commerce Platform  
**Audit date:** 2026-08-01  
**Scope:** Phase 1 only. Repository audit and implementation order before payments, paid ads, or social publishing.  
**Decision:** Do not run live payments or paid campaigns yet.

## Executive Summary

The project is a substantial multi-application e-commerce platform, not a blank rebuild. It already has a PostgreSQL-backed API, admin dashboard, storefront, mobile app, Stripe libraries, order/payment tables, product/media management, shipping/coupon/review schemas, newsletter, and analytics foundations.

It is **not ready to accept live payments or paid traffic yet**. The critical blockers are lifecycle and integration issues, not missing UI polish:

1. Stripe payment can succeed before an order exists.
2. Webhook idempotency table exists but is not used by the webhook handler.
3. Payment amounts are calculated from client-submitted prices in the payment-intent endpoint.
4. Currency/tax/shipping are hard-coded and inconsistent for an Italy-based international business.
5. Some storefront/mobile API paths do not match backend routes.
6. Analytics tracking emits event types and endpoints that do not match the backend schema.
7. Consent/pixels/product feeds/social commerce are not implemented yet.
8. Several customer-facing pages still show mock data.

The right next phase is to fix checkout/order/payment correctness first, then analytics/consent/product feed foundations, then ad platform integrations.

## Repository Map

| Path | Purpose | Status |
| --- | --- | --- |
| `tech-tools-api/` | Express + TypeScript API, PostgreSQL, Redis, Stripe service, commerce routes, migrations, workers | Main backend. Strong foundation, but payment/order lifecycle needs repair before live money. |
| `admin-dashboard/` | Next.js 16 admin app, shadcn/ui, React Query, Socket.IO metrics | Active admin control surface. Some real metrics exist, but payment/refund/marketing views are incomplete. |
| `e-commerce-web-store/` | React 19 + Vite customer storefront | Product browsing and checkout exist. Some pages still use mock data and route mismatches. |
| `tech-tools-mobile-app/` | Expo React Native mobile app | Mobile marketplace and checkout exist. Analytics endpoint is wrong; mobile checkout shares payment lifecycle risk. |
| `infrastructure/` | Docker Compose and Nginx dev/prod stack | Useful deployment setup with Nginx, SSL, app containers, Postgres, Redis. |
| `infra/` and `server-scripts/` | Server/firewall/ops helper scripts | Helpful operational scripts. Need live-server verification before launch. |
| `docs/` | Existing architecture, hardening, deployment, feature docs | Good prior documentation, including `docs/PRODUCTION-HARDENING-PLAN.md`. This audit supersedes for current Phase 1 execution order. |

No `AGENTS.md` file was found.

## Technology Stack

- Backend: Node.js, Express, TypeScript, PostgreSQL, Redis, Stripe SDK, Socket.IO, Nodemailer, Twilio, Winston, Docker.
- Admin: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts, Socket.IO client.
- Web storefront: React 19, Vite, TypeScript, Zustand, React Router, Stripe Elements, TanStack Query.
- Mobile: Expo, React Native, TypeScript, Stripe React Native, Zustand, SecureStore.
- Infra: Docker Compose, Nginx, Certbot, PostgreSQL 15, Redis 7, pgAdmin private tunnel pattern.

Applications communicate through `tech-tools-api` at `/api/v1`. Admin and web use environment-configured API URLs; mobile currently hard-codes `https://techtoolstore.com/api/v1` in `tech-tools-mobile-app/src/api/index.ts`.

## What Is Already Complete or Solid

- Product catalog schema: products, brands, categories, media, specs, inventory.
- Admin product/category/brand/collection services and pages exist.
- Order and payment tables exist, including `payments.transaction_id` uniqueness.
- Stripe SDK integration exists on API, web, and mobile.
- Stripe webhook signature verification uses captured raw body.
- Guest checkout schema exists.
- Admin order listing/detail/stat endpoints exist.
- Email, newsletter, WhatsApp, notification, contact, and analytics schemas exist.
- Admin account lockout and role checks exist.
- Nginx production config includes HTTPS redirect, HSTS, CSP, API and auth rate-limit blocks, and private pgAdmin routing.
- Web analytics captures UTM params into session storage.

## Critical Blockers

### 1. Payment Can Succeed Before Order Creation

Evidence:

- Web checkout creates a payment intent in `e-commerce-web-store/src/pages/CheckoutPage.tsx:118-136`.
- Web checkout confirms payment and only then creates the backend order in `e-commerce-web-store/src/pages/CheckoutPage.tsx:195-247`.
- Mobile checkout does the same pattern in `tech-tools-mobile-app/src/app/checkout.tsx:347-396`.
- API payment intent is created without an order ID in metadata in `tech-tools-api/src/api/v1/payments/payment.controller.ts:106-130`.
- Stripe service sets `metadata.orderId` to `params.orderId || ''` in `tech-tools-api/src/services/stripe.service.ts:154-156`.

Risk:

Stripe can capture money, then order creation can fail because of stock, API timeout, frontend crash, network loss, or validation error. The webhook may also arrive before `orderId` metadata is attached, causing `handlePaymentSucceeded` to return without updating any order.

Required fix:

Create a server-side checkout/order draft before payment confirmation, validate products/prices/stock on the server, attach `orderId` to the PaymentIntent at creation time, and let webhooks be the source of truth for final payment/order state.

### 2. Webhook Idempotency Table Exists but Is Not Used

Evidence:

- Migration creates `stripe_webhook_events` in `tech-tools-api/src/database/migrations/013_stripe_integration.sql`.
- Webhook handler processes events directly in `tech-tools-api/src/api/v1/payments/payment.controller.ts:733-764`.
- No insert/check against `stripe_webhook_events` appears in the handler.

Risk:

Stripe retries webhooks. Duplicate webhook processing can duplicate side effects, over-count analytics, double-grant digital entitlements, or double-apply refund deltas.

Required fix:

Wrap webhook processing in a database transaction. Insert `event.id` into `stripe_webhook_events` first with `ON CONFLICT DO NOTHING`; if already present, return success without reprocessing.

### 3. Payment Intent Amount Trusts Client Prices

Evidence:

- Frontend sends `price` for each item in `e-commerce-web-store/src/pages/CheckoutPage.tsx:118-124`.
- API calculates amount from `items` using `stripeService.calculateOrderAmount(items)` in `tech-tools-api/src/api/v1/payments/payment.controller.ts:95-97`.
- `calculateOrderAmount` multiplies `item.price * item.quantity`.

Risk:

A user can alter client JavaScript or API payloads to pay less than the real product price.

Required fix:

Payment intent and order totals must be calculated only from database product/variant prices, coupons, shipping methods, and tax rules.

### 4. Currency, Tax, and Shipping Are Not Launch-Ready

Evidence:

- Web checkout requests `currency: 'usd'` in `e-commerce-web-store/src/pages/CheckoutPage.tsx:132`.
- Web checkout tracks payment success with `'EUR'` in `e-commerce-web-store/src/pages/CheckoutPage.tsx:249-255`.
- Orders default to `USD` in `tech-tools-api/src/database/migrations/001_initial_schema.sql`.
- API order tax is hard-coded at `0.08` and shipping is hard-coded as free over 50 or `5.99` in `tech-tools-api/src/api/v1/orders/order.controller.ts:834-838`.
- Shipping settings default country/unit are US/lb/in in `tech-tools-api/src/database/migrations/005_shipping.sql`.

Risk:

Incorrect totals, VAT, invoices, ads reporting, and accounting for an Italy-based business.

Required fix:

Define default currency, supported currencies, VAT/tax handling, origin address, shipping zones/methods, and display/reporting currency. For launch, use EUR unless the business intentionally prices in USD.

### 5. Order Creation Is Not Transactional

Evidence:

- `createOrder` performs multiple independent `query(...)` calls for order, items, inventory reservation, Stripe metadata update, emails, and WhatsApp in `tech-tools-api/src/api/v1/orders/order.controller.ts:846-924`.
- No database transaction is used.

Risk:

Partial orders can exist: order without all items, reserved stock without complete order, or failed metadata update after order insert.

Required fix:

Use a database transaction for order draft creation, order items, inventory reservation, coupon usage, and payment intent linkage. Send emails after commit and only for paid/confirmed states.

### 6. Refund/Cancellation Flow Uses Conflicting Payment Status Values and Inventory Tables

Evidence:

- Order `payment_status` enum includes `paid`, but `payments.status` includes `completed`.
- Customer cancellation checks `order.payment_status === 'completed'` from an aliased payment join in `tech-tools-api/src/api/v1/orders/order.controller.ts:1095-1126`.
- Cancellation restores `products.stock_quantity` in `tech-tools-api/src/api/v1/orders/order.controller.ts:1142-1153`, while checkout reserves `inventory.reserved_stock` in `tech-tools-api/src/api/v1/orders/order.controller.ts:900-907`.

Risk:

Refunds may not trigger correctly, stock can become inaccurate, and admin/payment state can drift.

Required fix:

Normalize order payment states vs payment transaction states. Reverse reservations through the `inventory` table, not `products.stock_quantity`.

## API and Frontend Mismatches

### Storefront User Routes Use `/user`, Backend Mounts `/users`

Evidence:

- Backend mounts users at `/users` in `tech-tools-api/src/api/v1/index.ts:53`.
- Storefront calls `/user/profile`, `/user/addresses`, `/user/change-password` in `e-commerce-web-store/src/api/index.ts:421-465`.

Impact:

Profile, addresses, and settings flows can fail.

### Legacy Storefront Order/Wishlist/Cart APIs May Be Dead

Evidence:

- Storefront still has older APIs under `/user/orders`, `/user/wishlist`, `/cart/sync`, `/cart/validate`, `/cart/coupon`.
- Backend mounted routes are `/orders`, `/users`, `/coupons`, and no obvious `/cart` route is mounted in `tech-tools-api/src/api/v1/index.ts`.

Impact:

Some pages may silently use mock/client-only behavior or fail when connected to production.

### Mobile Analytics Endpoint Is Wrong

Evidence:

- Mobile sends analytics to `/api/v1/events/batch` in `tech-tools-mobile-app/src/services/event-tracking.ts:98`.
- Backend exposes `/api/v1/analytics/events/batch` in `tech-tools-api/src/api/v1/analytics/analytics.routes.ts`.

Impact:

Mobile analytics attribution will not reach the backend.

### Storefront Emits Event Types Missing From DB Enum

Evidence:

- Storefront emits `page_view` and `error` in `e-commerce-web-store/src/hooks/useEventTracking.ts:185-220`.
- DB enum in `tech-tools-api/src/database/migrations/026_unified_analytics_schema.sql:8-27` does not include those event types.

Impact:

Analytics inserts can fail or lose page/error events, which damages marketing attribution and conversion diagnostics.

## Placeholders, Mock Data, and Partial Features

- Product variations endpoints return “Not yet implemented” in `tech-tools-api/src/api/v1/products/product.controller.ts:1301-1370`.
- Legacy customer order status update and order items routes return “Not yet fully implemented” in `tech-tools-api/src/api/v1/orders/order.controller.ts:1065-1192`.
- Web order tracking page uses mock tracking data in `e-commerce-web-store/src/pages/TrackOrderPage.tsx:41-125`.
- Web orders page uses mock orders in `e-commerce-web-store/src/pages/OrdersPage.tsx:23-45`.
- Shipping carrier services return mock rates/labels/tracking when credentials are absent.
- Product card rating/review displays include placeholder behavior.
- Social footer links point to generic social domains, not real brand profiles.

These are not all blockers for a controlled soft launch, but they are blockers for paid traffic and customer trust.

## Security and Compliance Risks

- Web/admin auth tokens are stored in `localStorage`, increasing exposure if third-party pixels/scripts are later added.
- Paid ad pixels, GTM, and Tawk-style scripts make token storage risk more important.
- No consent management gate exists for EU analytics/marketing cookies.
- Legal pages exist, but content must be reviewed for the actual legal entity, Italy/EU GDPR requirements, VAT, returns, shipping, refunds, and seller obligations.
- API global rate limit exists, but payment/order endpoints should receive stricter anti-abuse rules and idempotency keys.
- Stripe live/test separation is not fully documented or enforced in code.
- `tech-tools-api/.env.production.example` does not list `STRIPE_WEBHOOK_SECRET`, while the production compose requires it.
- Root `.env.example` also omits Stripe webhook secret and social/analytics credentials.
- Actual `.env` files exist in the repo workspace; do not commit secrets. Rotate any secrets that were ever committed.

## Marketing and Social-Commerce Readiness

Not implemented yet:

- Meta/Facebook product catalog feed.
- Instagram Shop catalog sync.
- Meta Pixel.
- Meta Conversions API.
- TikTok Pixel.
- TikTok Events API.
- TikTok catalog sync.
- Google Merchant Center feed.
- GA4/GTM production setup.
- Google Ads/YouTube remarketing/conversion workflow.
- Consent mode and region-aware consent enforcement.
- Server-side purchase attribution tied to orders/payments.
- UTM campaign dashboard by channel/campaign/ad set/ad creative.

Existing useful foundations:

- Product catalog and media data exist.
- UTM capture exists in web analytics.
- Events table has campaign-ish columns and source/session fields.
- Admin analytics pages query real events/orders in several places.

Before any ad spend, build marketing tracking in disabled/test mode and require explicit approval before publishing catalogs or running ads.

## Environment Variables and External Accounts Needed

Required before payment testing:

- Stripe test secret key.
- Stripe test publishable key.
- Stripe webhook signing secret.
- Stripe account country/business profile configured for Italy/international selling.
- Public domain verified in Stripe for Apple Pay/Google Pay if wallet payments are enabled.
- SMTP credentials for transactional email.
- Real store support email and admin notification email.
- Default currency/tax/shipping settings.

Required before social/ads work:

- Meta Business Manager.
- Meta Pixel ID and access token for Conversions API.
- Facebook/Instagram catalog/business assets.
- TikTok Business Center.
- TikTok Pixel ID and Events API token.
- Google Analytics 4 measurement ID.
- Google Tag Manager container ID, if using GTM.
- Google Merchant Center account.
- Consent management provider/configuration.
- Real social profile URLs.

## Deployment Readiness

Already present:

- Production Docker Compose stack.
- Nginx reverse proxy, HTTPS, HSTS, API/auth rate limits.
- pgAdmin private-access pattern.
- Backup and maintenance scripts.

Needs verification before launch:

- Production env values are real, rotated, and not placeholders.
- Database migrations run cleanly on a fresh database and on current production data.
- SSL/certbot renewal works.
- Automated database backups and restore test are confirmed.
- Disk, memory, and log alerts are configured.
- Origin firewall allows Cloudflare only if Cloudflare is the intended front door.
- Sentry or equivalent error monitoring is added for API, admin, web, and mobile.
- Stripe webhook endpoint is publicly reachable over HTTPS.

## Prioritized Roadmap

### Critical Blockers

1. Redesign checkout lifecycle: server creates order draft + PaymentIntent together.
2. Server-side totals only: product price, variant price, coupon, tax, shipping.
3. Add webhook idempotency and transaction boundaries.
4. Make order creation, inventory reservation, and payment intent linkage transactional.
5. Fix payment/order state machine and refund/cancellation stock reversal.
6. Fix route mismatches: `/user` vs `/users`, mobile analytics endpoint, missing event types.
7. Remove customer-facing mock order/tracking data or replace with real empty states.

### Required Before Accepting Payments

1. Stripe test-mode end-to-end flow for authenticated and guest checkout.
2. Webhook tests for success, failure, pending/requires_action, cancellation, refund.
3. Admin payment visibility: order detail shows transaction, gateway status, refund history.
4. No confirmation email until the payment is confirmed or explicitly marked pending for an async payment method.
5. Idempotency keys for checkout/order creation.
6. EUR/VAT/shipping policy configured for Italy/international sales.
7. Payment setup documentation with test/live separation.

### Required Before Launch

1. Real account/profile/address/wishlist/order pages wired to backend.
2. Product variations implemented or hidden if not used.
3. Shipping methods/zones connected to checkout.
4. Returns/refunds policy and workflow connected to real order/payment state.
5. Transactional emails verified in production SMTP.
6. Error monitoring and backup restore test.
7. Legal/privacy/cookie pages reviewed for real business details.

### Marketing and Social-Commerce Integrations

1. Consent banner and analytics consent mode.
2. Stable product feed endpoint for Meta/TikTok/Google with IDs, prices, availability, image URLs, GTIN/MPN/brand where available.
3. GA4/GTM page/product/cart/checkout/purchase events.
4. Meta Pixel + Conversions API.
5. TikTok Pixel + Events API.
6. UTM storage tied to order/payment records.
7. Admin attribution reports by source/medium/campaign.
8. Organic publishing workflow only after catalog data is stable.
9. Paid ad creation/spend only after explicit approval.

### Can Wait Until After Launch

1. Advanced A/B testing.
2. Predictive analytics.
3. Full supplier automation.
4. Advanced creator/seller monetization flows.
5. Deep video/YouTube publishing automation.
6. Multi-currency display if initial launch uses one settlement/display currency.

## Claude Implementation Brief

Give Claude this exact first implementation scope:

> Work only on Phase 2A: make checkout/payment safe in test mode. Do not add pixels, ads, social publishing, or live payments. Preserve the existing architecture and UI.

Files Claude should inspect first:

- `tech-tools-api/src/api/v1/payments/payment.controller.ts`
- `tech-tools-api/src/services/stripe.service.ts`
- `tech-tools-api/src/api/v1/orders/order.controller.ts`
- `tech-tools-api/src/api/v1/orders/order.routes.ts`
- `tech-tools-api/src/database/migrations/001_initial_schema.sql`
- `tech-tools-api/src/database/migrations/013_stripe_integration.sql`
- `e-commerce-web-store/src/pages/CheckoutPage.tsx`
- `e-commerce-web-store/src/components/checkout/StripePaymentForm.tsx`
- `e-commerce-web-store/src/api/index.ts`
- `tech-tools-mobile-app/src/app/checkout.tsx`
- `tech-tools-mobile-app/src/api/index.ts`

Claude should implement in this order:

1. Add a backend checkout session/order draft endpoint that validates cart items from database prices, stock, variant data, coupon, shipping, tax, and currency.
2. Create the order draft and order items inside a DB transaction before Stripe confirmation.
3. Create or update PaymentIntent server-side with `metadata.orderId`, `metadata.orderNumber`, and the validated amount/currency.
4. Update web checkout to call the backend checkout-session endpoint before confirming Stripe payment.
5. Update mobile checkout to use the same lifecycle.
6. Add webhook idempotency using `stripe_webhook_events`.
7. Make `payment_intent.succeeded` transition order to paid/confirmed and create/update the payment row idempotently.
8. Make `payment_intent.payment_failed`, canceled, and refund events update order/payment state consistently.
9. Move order confirmation emails/WhatsApp to post-payment confirmation, not pre-payment order creation.
10. Fix inventory reservation/release to use the `inventory` table consistently.
11. Add tests for server-side price tampering, webhook duplicate delivery, successful payment, failed payment, and refund.
12. Run `npm run type-check` in `tech-tools-api`, `admin-dashboard`, and `tech-tools-mobile-app`; run `npm run build` in `e-commerce-web-store`.

Acceptance criteria for Claude:

- A client cannot choose the payment amount.
- A successful Stripe payment always maps to exactly one order.
- Duplicate webhooks do not duplicate side effects.
- A paid order cannot remain permanently stuck as `pending` when webhook succeeds.
- If order creation fails, payment is not confirmed/captured.
- Guest and authenticated checkout both work in Stripe test mode.
- Admin order detail shows the real payment record.
- No live keys or real transactions are used.

## Validation Notes

Validation commands completed after the audit document was created:

- `tech-tools-api`: `npm run type-check` passed.
- `admin-dashboard`: `npm run type-check` passed.
- `e-commerce-web-store`: `npm run build` passed.
- `tech-tools-mobile-app`: `npm run typecheck` passed.

No database migrations or live payment transactions were run during this audit.

## Final Recommendation

Use Stripe for the payment provider. It fits the existing codebase and supports Italy-based international commerce, hosted/provider-supported payment flows, wallets, webhooks, refunds, test/live separation, and strong documentation. The current Stripe implementation should be repaired, not replaced.

Do not begin Meta/TikTok/Google ad integrations until checkout/payment and consent are correct. Paid traffic will multiply every lifecycle bug.
