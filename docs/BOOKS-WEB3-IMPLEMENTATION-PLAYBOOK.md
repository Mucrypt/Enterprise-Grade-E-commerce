# Books + Web3 Implementation Playbook

## TechTools Store Growth Plan (Execution Source of Truth)

> Purpose: Turn TechTools into a creator-driven commerce platform by launching a digital books marketplace first, then layering walletless Web3 utilities after traction.
>
> Outcome target: New high-margin revenue stream, creator moat, stronger buyer retention, and higher acquisition value.

---

## 1) Strategic Decision

### Why this order wins

1. Build digital books marketplace first (fastest path to GMV and margin).
2. Add Web3 later as invisible infrastructure (walletless) to improve royalties/provenance, not to block conversion.

### Product thesis

Create a "Shop + Learn + Earn" model:

1. Creators publish digital books and learning assets.
2. Buyers discover through social content and proof.
3. One-tap checkout for digital + physical products.
4. Later, ownership perks and automated royalties via Web3.

---

## 2) 90-Day Delivery Plan

## Phase 1 (Weeks 1-4): Digital Books MVP

### Goals

1. Let creators publish and sell digital books.
2. Let customers buy and securely access content.
3. Let admin moderate quality, rights, and abuse.

### Deliverables

1. Product kind support:
   - `physical`
   - `digital_book`
   - `digital_bundle`
2. Creator/publisher profiles and onboarding state.
3. Upload pipeline for PDF/EPUB + cover + optional sample.
4. Purchase unlock flow with signed URLs and reading access.
5. Admin moderation queue + DMCA/takedown flow.
6. Creator dashboard (sales, earnings, top books, conversion).

## Phase 2 (Weeks 5-8): Viral Distribution Layer

### Goals

1. Drive discovery loops and creator-led growth.
2. Improve conversion from content to checkout.

### Deliverables

1. Short-form "book trailer" posts linked to products.
2. Feed ranking by watch time -> CTR -> conversion.
3. Save/share/remix hooks.
4. Affiliate links for creators/readers.
5. Bundles (`book + tool + template`).

## Phase 3 (Weeks 9-12): Walletless Web3 Layer

### Goals

1. Add creator economics and provenance benefits.
2. Keep fiat checkout and mainstream UX intact.

### Deliverables

1. Walletless identity (custodial wallet under the hood).
2. Purchase badges / limited collectibles.
3. On-chain royalty split contracts.
4. Export wallet option for advanced users.
5. Ownership perks (gated content/discounts/community).

---

## 3) Architecture Blueprint by App

## A) API (tech-tools-api)

### New/updated domain model

1. `products`:
   - Add `product_kind` enum-like field (`physical|digital_book|digital_bundle`).
   - Keep existing `is_digital` for backward compatibility.
2. `creator_profiles`:
   - `id`, `user_id`, `display_name`, `bio`, `avatar_url`, `payout_status`, `tax_status`, `is_verified`.
3. `digital_assets`:
   - `id`, `product_id`, `asset_type` (`full|sample|cover|audio`), `storage_url`, `mime_type`, `file_size`, `checksum`, `watermark_template`, `is_active`.
4. `digital_entitlements`:
   - `id`, `order_id`, `order_item_id`, `user_id`, `product_id`, `license_type`, `granted_at`, `expires_at`, `device_limit`, `revoked_at`.
5. `reading_progress`:
   - `id`, `user_id`, `product_id`, `location_ref`, `percent_complete`, `updated_at`.
6. `copyright_reports`:
   - `id`, `reporter_user_id`, `product_id`, `reason`, `evidence_url`, `status`, `reviewed_by`, `reviewed_at`.
7. `creator_payout_ledger`:
   - per-sale split records for creator/platform/affiliate.

### API endpoints (Phase 1)

Public/customer:

1. `GET /api/v1/books` (filter by genre/language/price/rating).
2. `GET /api/v1/books/:slug`.
3. `GET /api/v1/books/:id/sample`.
4. `GET /api/v1/library/me`.
5. `GET /api/v1/library/me/:productId/access-url` (signed URL, short TTL).
6. `PUT /api/v1/library/me/:productId/progress`.

Creator:

1. `POST /api/v1/creator/profile`.
2. `PUT /api/v1/creator/profile`.
3. `POST /api/v1/creator/books`.
4. `POST /api/v1/creator/books/:id/assets`.
5. `GET /api/v1/creator/dashboard/metrics`.

Admin:

1. `GET /api/v1/admin/books/review-queue`.
2. `POST /api/v1/admin/books/:id/approve`.
3. `POST /api/v1/admin/books/:id/reject`.
4. `GET /api/v1/admin/copyright/reports`.
5. `POST /api/v1/admin/copyright/reports/:id/resolve`.

### Core security controls

1. Signed URL expiration <= 120 seconds.
2. Per-user watermarking for downloadable files.
3. Download rate limits + device fingerprint limits.
4. Entitlement check on every read/download request.
5. Audit log for admin moderation decisions.

## B) Admin Dashboard (admin-dashboard)

### New modules

1. Creator management:
   - creator profile verification
   - payout/tax status
2. Books moderation:
   - pending approvals
   - quality checklist
   - rights declaration review
3. Copyright operations:
   - takedown queue
   - report resolution workflow
4. Revenue analytics:
   - digital GMV
   - top creators
   - refund and chargeback rates

### Required screens

1. `Books` list + status tabs (`draft|pending|approved|rejected|published`).
2. `Book Detail` with metadata, assets, rights declaration, and moderation actions.
3. `Creator Detail` with sales and payout ledger summary.
4. `Copyright Reports` queue with SLA markers.

## C) Web Store (e-commerce-web-store)

### New customer experiences

1. Books catalog page.
2. Book detail page with:
   - preview/sample
   - author/creator profile card
   - license terms
3. Post-purchase library page.
4. In-browser reader for entitled users.

### Conversion features

1. Related bundles section.
2. Social proof blocks (reads/saves/reviews).
3. Fast checkout path for digital-only cart.

## D) Mobile App (tech-tools-mobile-app)

### New customer experiences

1. Books tab/discovery rail on home.
2. Book detail + sample preview.
3. My Library screen.
4. Mobile reader + progress sync.

### Performance requirements

1. Reader open < 2s on normal 4G.
2. Background progress sync with retry.
3. Offline cache for entitled content (optional in Phase 1.5).

---

## 4) Detailed Phase 1 Work Breakdown (Week-by-Week)

## Week 1: Data and Platform Foundation

1. Add migration(s) for product kind + creator + digital asset + entitlement + progress tables.
2. Add indexes for entitlement checks and library listing.
3. Add storage service extensions for book assets and sample assets.
4. Add anti-abuse middleware for signed download endpoints.

Definition of done:

1. Migrations run clean in dev and prod-like env.
2. CRUD integration tests pass for new tables.
3. Signed URL endpoint returns expiring links.

## Week 2: Creator Publishing + Admin Moderation Core

1. Implement creator profile APIs.
2. Implement creator book creation/edit endpoints.
3. Implement asset upload and validation:
   - PDF/EPUB max-size enforcement
   - MIME verification
4. Implement admin review queue endpoints.

Definition of done:

1. Creator can submit a book to review.
2. Admin can approve/reject and status is persisted.
3. Rejected books carry reason codes.

## Week 3: Customer Purchase + Entitlement + Reader MVP

1. Extend checkout to grant digital entitlements on successful payment.
2. Build My Library endpoint and web/mobile screens.
3. Build basic web/mobile reader access flow.
4. Add reading progress write/read API.

Definition of done:

1. Purchased book appears in library within 5 seconds.
2. Entitled user can open content; non-entitled user is blocked.
3. Progress resumes after reopen.

## Week 4: Hardening + Analytics + Launch Readiness

1. DMCA report endpoint + admin resolution flow.
2. Creator dashboard metrics endpoint.
3. KPI instrumentation and monitoring alerts.
4. QA/UAT runbook and rollback plan.

Definition of done:

1. Legal/report workflow works end-to-end.
2. Revenue and activation metrics visible in dashboard.
3. Production readiness checklist completed.

---

## 5) KPI Framework (Track From Day 1)

Acquisition and activation:

1. Creator activation rate.
2. Time-to-first-book-published.
3. Time-to-first-sale by creator.

Revenue and margin:

1. Digital GMV.
2. Net digital margin.
3. Average revenue per creator.
4. Attach rate of bundles.

Engagement and retention:

1. Reader repeat purchase (30-day).
2. Library return rate (D7/D30).
3. Completion rate (book progress > 80%).

Risk and quality:

1. Refund rate.
2. Chargeback rate.
3. Copyright report volume and resolution SLA.

---

## 6) Monetization Design

1. Platform fees:
   - 15% digital books
   - 8-12% creator physical products
2. Reader Pass subscription:
   - monthly credits + exclusive drops
3. Creator Pro tools:
   - analytics, A/B cover tests, paid boosts
4. Affiliate commissions for creators/readers.

---

## 7) Web3 Layer Design (Phase 3, Walletless)

### Product principles

1. Never force crypto setup at checkout.
2. Wallet exists in background; export is optional.
3. Keep fiat payment primary.

### Initial Web3 use cases

1. Creator royalty splits on secondary usage/licensing.
2. Ownership badges tied to purchases.
3. Gated access perks for ownership holders.

### Non-goals for first Web3 release

1. No mandatory gas fee user flows.
2. No wallet-only onboarding.
3. No speculative token mechanics.

---

## 8) Compliance, Trust, and Legal Requirements

1. Rights declaration required at creator submission.
2. DMCA/takedown workflow with clear SLA.
3. Immutable moderation audit logs.
4. Watermarked payload delivery for purchased files.
5. Privacy-safe handling of reading analytics.

---

## 9) Production Readiness Checklist

1. Security:
   - signed URL TTL and scope validation
   - rate limits and anomaly alerts
2. Reliability:
   - queue retries for asset processing
   - idempotent entitlement grant flow
3. Observability:
   - dashboards for upload failures, grant latency, reader errors
4. Rollback:
   - feature flags for books catalog and library
5. Business:
   - support playbooks for refunds and takedowns

---

## 10) Execution Backlog Template (Use for Sprint Planning)

For each ticket include:

1. User story.
2. Scope and acceptance criteria.
3. API contract changes (if any).
4. Data model changes (if any).
5. Security and abuse checks.
6. Telemetry events.
7. QA test matrix.
8. Rollback steps.

---

## 11) Immediate Next Steps (Start Now)

1. Approve this plan as the implementation baseline.
2. Create Phase 1 feature flags:
   - `books_marketplace_enabled`
   - `creator_portal_enabled`
   - `digital_library_enabled`
3. Open Sprint 1 tickets from Week 1 section.
4. Start with schema migration + storage + entitlement endpoints.

---

## 12) Success Criteria After 90 Days

1. Creator marketplace live with measurable GMV.
2. Repeat purchase and retention from digital library behavior.
3. Moderation/legal workflows operating within SLA.
4. Web3 features deployed without hurting checkout conversion.
5. Platform value story strengthened for strategic sale/acquisition.

---

## Appendix A: Suggested Milestones and Owners

1. Platform/Data Owner:
   - migrations, entitlement model, security controls
2. API Owner:
   - publishing, moderation, library endpoints
3. Admin Owner:
   - moderation UI, creator operations, analytics views
4. Web Owner:
   - catalog, product page, reader web UX
5. Mobile Owner:
   - library and reader mobile UX
6. Growth Owner:
   - KPI instrumentation, experiments, conversion optimization

---

## Appendix B: Risk Register

1. Copyright abuse at scale:
   - mitigation: rights declaration + DMCA queue + repeat-offender policy
2. File sharing piracy:
   - mitigation: watermarking + signed URLs + behavioral detection
3. Creator churn:
   - mitigation: fast onboarding + dashboards + payout transparency
4. Poor discovery:
   - mitigation: Phase 2 content feed and affiliate loops
5. Web3 conversion risk:
   - mitigation: keep walletless and optional
