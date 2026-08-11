# PROMOTION-OPS-1 — Marketing Command Center Implementation Report

**Phase:** PROMOTION-OPS-1 (built after ADMIN-2B-PRODUCTION-REVIEW-1, which is complete and separately reported in `docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md`). Organic/free social publishing only — no paid ads, per explicit instruction. See `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` for the full technical reference this report doesn't duplicate.

---

## 1. Current marketing-system audit

Performed before writing any code:

- **`/dashboard/promotions`**: linked from the sidebar (a "Marketing" parent nav group with `Promotions`/`Coupons` children already existed, permission-gated `marketing.view`) but no page existed — confirmed via `find admin-dashboard/app -ipath "*promotion*"` returning nothing. Production 404s exactly as reported.
- **`/dashboard/coupons`**: real, working (~1300-line single-page component, stats + filters + table + create/edit dialog), calling `GET/POST/PATCH /coupons` directly. Reused as-is via a new `CouponPicker` — no second discount engine built.
- **Newsletter engine** (`newsletter.queue.ts`, `newsletter_campaigns`/`newsletter_campaign_recipients`): confirmed real, with draft/scheduled/sending/sent/cancelled lifecycle, A/B testing, link-click tracking, and a scheduled-send poller. Not modified. Its poller shape (`setInterval` + re-entrancy guard, no job-queue library) is the one pattern this phase's own `promotion-campaign.queue.ts` deliberately mirrors.
- **Analytics 2.0 Acquisition** (`GET /analytics/acquisition`, built in ADMIN-2B): confirmed it already captures `user_sessions.utm_source/utm_medium/utm_campaign/utm_content` at session start. This phase's UTM builder (`promotion.utm.ts`) produces URLs that endpoint already knows how to attribute — no changes made to it.
- **`POST /ai/campaigns/generate`**: confirmed gated `authorize('admin','super_admin')` — legacy-only, no path for a new-model staff role. Reassessed and fixed (§ below).
- **Staff permission matrix**: confirmed `marketing.view`/`marketing.manage`/`campaigns.view`/`campaigns.manage` already existed; `campaigns.*` were unused anywhere in code. `MARKETING_MANAGER` already held `marketing.view/manage` + `campaigns.view/manage`; `MARKET_MANAGER` held `marketing.view` only — exactly as the phase brief stated.
- **`/dashboard/media`**: confirmed a pure placeholder (hardcoded zero stats, no-op upload button, no drag/drop wiring) — not claimed as a working asset library, not built into one this phase; campaign creatives use their own narrow upload endpoint instead (§14).
- **Encryption reality check**: confirmed `email_sender_aliases.smtp_pass_encrypted` (`email.service.ts`) is genuinely stored/read as plaintext despite its name — a literal `// TODO: Decrypt` sits beside every read. `whatsapp_settings.is_encrypted` is a masking flag only, not backed by real encryption. **No real encryption utility existed anywhere in this codebase.** Confirmed this is not repeated for social OAuth tokens (§8/§13).
- **Job-queue infrastructure**: confirmed no Bull/BullMQ/any queue library is installed; Redis is used only for refresh-token storage. Every async worker in this codebase (`newsletter.queue.ts`, `supplier.guardrails.ts`, `workers/anomaly.detection.ts`, `workers/metrics.broadcaster.ts`) is a plain `setInterval` poller. This phase's scheduler follows the same convention rather than introducing a new one.
- **Media/Sharp infrastructure**: confirmed real and reusable (`utils/media.ts`'s `optimizeImage()`, `media-storage.service.ts`'s pluggable local/R2/Cloudinary storage). Reused for campaign creatives via a new, narrowly-scoped controller rather than expanding the shared `IMAGE_SIZES` map used by every other image-upload flow.
- **Video processing**: confirmed `utils/media.ts`'s `processVideo()` is a placeholder (`// TODO: Implement FFmpeg`) — no real video pipeline exists. Creative upload this phase is image-only as a direct consequence.

---

## 2. The 404 — cause and fix

**Cause**: the sidebar nav item existed; the Next.js page file under `app/(dashboard)/dashboard/promotions/` simply did not exist. Not a routing misconfiguration — a missing page.

**Fix**: `admin-dashboard/app/(dashboard)/dashboard/promotions/{page,new/page,[id]/page,[id]/edit/page,calendar/page,connections/page,connections/callback/page}.tsx` — 7 real pages, all wired to real backend endpoints, all permission-gated via `RequirePagePermission`.

---

## 3. Schema

Two migrations, `042_social_connections.sql` and `043_promotion_campaigns.sql` — full column-level detail in `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` §1. Summary: `social_connections`, `social_publish_attempts`, `social_metric_snapshots` (042, zero campaign dependency); `promotion_campaigns`, `promotion_campaign_products`, `promotion_channel_posts`, `promotion_activity_log` (043, clean forward FK to `social_connections`). `newsletter_campaigns` untouched — a promotion campaign may reference a coupon (`coupon_id → coupons.id`, existing table) but has no newsletter/WhatsApp linkage built this phase (see §20).

**Migration number verification**: no live Postgres connection was available in this environment (confirmed via `pg_isready` failure) to check the real `schema_migrations` table. `042`/`043` were chosen from the local migration-file sequence only (last existing file: `041_staff_memberships.sql`). **The founder must verify the actual next-free migration number against the production database before applying** — these files are written and syntax-checked, not applied.

---

## 4. Permission model

Six new permissions (`social.view`, `social.publish`, `social.schedule`, `social.analytics`, `social.accounts.view`, `social.accounts.manage`) added to `staff-permissions.config.ts`. Full grant matrix and rationale in the architecture doc §2. Headline invariant, protected by a new regression test suite (`staff-permissions.config.test.ts`, 6 tests): **`MARKET_MANAGER` holds none of the 6 new permissions** — never silently gains publishing authority. `social.accounts.*` is OWNER/SUPER_ADMIN-only, including for ADMIN and MARKETING_MANAGER — posting content and connecting company accounts are enforced as genuinely separate privileges.

---

## 5. Campaign lifecycle

*(Originally published with a `PUBLISHED`-only success terminus and a `SKIPPED_DRY_RUN` channel status; corrected in Production Review Round 1 §R1.3 — a dry-run campaign can now only ever reach `DRY_RUN_COMPLETED`, never `PUBLISHED`, and `REQUIRES_ACTION` was added at the channel level for an ambiguous outcome. Diagram and enum list below reflect the current, actual code.)*

```
DRAFT ──(schedule)──▶ SCHEDULED ──(queue tick, time arrives)──▶ PUBLISHING ──▶ PUBLISHED (all channels really published)
  │                        │                                         │
  │                        │(publish-now, immediate)                 ├──▶ DRY_RUN_COMPLETED (all channels simulated)
  │                        ▼                                         │
  │                    PUBLISHING                                    ├──▶ PARTIAL_SUCCESS (mixed outcomes, or any channel REQUIRES_ACTION)
  │                                                                   │
  └──(cancel)──▶ CANCELLED                                           └──▶ FAILED (every channel terminally failed)
```

Editing (`PATCH /promotions/campaigns/:id`) is only permitted while `status = 'DRAFT'` — enforced server-side (`assertEditable()`), returns `409` otherwise, not merely hidden in the UI. Cancellation is only permitted from `DRAFT`/`SCHEDULED` (`409` once publishing has genuinely started — cancelling mid-publish would leave already-succeeded channels in an undefined state, so it isn't offered). Channel-post-level status (`DRAFT/QUEUED/PUBLISHING/PUBLISHED/FAILED/CANCELLED/DRY_RUN_SUCCEEDED/REQUIRES_ACTION`) is independent per channel — see the architecture doc §4 for the full reconciliation logic that derives campaign-level status from channel-level statuses.

---

## 6. Adapter architecture

One `SocialPublisherAdapter` interface, one class per platform (`facebook.adapter.ts` … `x.adapter.ts`), one `registry.ts` — no `if (platform === X)` branching anywhere outside `social-adapters/`. OAuth endpoint URLs and parameters for all 6 platforms were checked against each platform's current official developer documentation at implementation time, not reconstructed from memory — table of exact endpoints, capability matrix, and per-platform notes in the architecture doc §3.

---

## 7. OAuth / token security

- **Encryption**: new `utils/secret-encryption.ts`, real AES-256-GCM, written from scratch after confirming no real encryption existed anywhere in this codebase (§1). Key resolution mirrors `jwt.config.ts`'s fail-closed-in-production pattern. Key rotation is documented (versioned ciphertext format + `token_encryption_key_version` column make it possible) but not scripted this phase.
- **Never-leak guarantees**: `SocialConnectionDto` is an allowlist type, not a raw-row passthrough — token columns are structurally absent from every API response, verified by a test that plants real-looking ciphertext in a mocked DB row and asserts it never appears in the serialized JSON. Disconnecting a connection nulls both token columns, not just the status.
- **CSRF/state**: random state + PKCE verifier per OAuth attempt, single-use, swept after 10 minutes, verified by a test asserting an unrecognized/expired state 400s before any token exchange is attempted.
- **Where the token exchange happens**: entirely server-side (`social-connection.controller.ts`'s `completeOAuth()`) — the frontend callback page is a thin pass-through that never sees or stores a token. Full sequence diagram in the architecture doc §5.

---

## 8. Scheduling / queue strategy

`promotion-campaign.queue.ts` — a `setInterval` poller matching `newsletter.queue.ts`'s exact shape (this codebase's one consistent worker convention; no Bull/BullMQ introduced). Tick sequence, backoff formula, and the campaign-status reconciliation rule ("never roll back an already-published channel") are detailed in the architecture doc §4. Registered in `src/index.ts` alongside the other four existing workers, both at startup and in both graceful-shutdown handlers (`SIGTERM`/`SIGINT`).

---

## 9. Idempotency

*(Originally shipped with the stuck-row-sweep gap below still open; closed in Production Review Round 1 §R1.6 — see the fourth guarantee added below. Failure classification, described here only at a high level, is detailed in §R1.5.)*

Four-part guarantee: (1) a row is claimed — moved to `PUBLISHING` via an atomic `UPDATE ... RETURNING` — **before** any network call; (2) a row already carrying a `remote_post_id` is never re-published, only reconciled; (3) `social_publish_attempts` is an append-only ledger of every attempt for audit/investigation; (4) a row stuck in `PUBLISHING` past a safety timeout is swept to `REQUIRES_ACTION` — never blindly requeued, since the outcome of the interrupted attempt is genuinely unknown (`sweepStuckPublishingRows()`, §R1.6). Verified by 23 tests in `promotion-campaign.queue.test.ts` (up from the original 10), including an explicit idempotency-guard test (a claimed row with a pre-existing `remote_post_id` never calls `adapter.publish()`), dry-run rows never calling the adapter, campaign-status reconciliation never touching an in-flight campaign, and the stuck-row sweep itself. Still-open gap, honestly: none of the 6 adapters implement a provider-side "does this post already exist" reconciliation lookup — resolving a `REQUIRES_ACTION` channel today means a human checks the platform directly and reports the outcome via `POST /promotions/campaigns/:id/channels/:channelPostId/resolve`.

---

## 10. UTM / attribution strategy

`promotion.utm.ts`'s `buildUtmUrl()` produces `utm_source=<platform>&utm_medium=social&utm_campaign=<campaign_key>&utm_content=<channel_post_id>`, reusing the Analytics 2.0 Acquisition endpoint's existing `user_sessions.utm_*` columns — no new analytics table, no second attribution engine. 5 tests cover exact shape, per-platform lowercasing, existing-query-param preservation, and invalid-URL rejection.

---

## 11. Social metric sync

`social_metric_snapshots` — periodic snapshots (not live-queried per page view), synced by the queue's `syncMetrics()` phase at most once per 30 minutes (env-configurable), for published/non-dry-run posts lacking a recent snapshot. Metric columns are nullable, never zero-filled — a platform that doesn't return a given metric leaves it `NULL`, distinct from a confirmed zero. TikTok's adapter honestly returns `{}` from `fetchMetrics()` since its Content Posting API scope doesn't expose post-level analytics.

---

## 12. Campaign analytics

`GET /promotions/campaigns/:id/metrics` returns the latest snapshot per channel (social platform metrics — impressions/reach/likes/comments/shares/clicks, honestly null where unsupported) plus a `dataQuality.note` pointing to Analytics 2.0 Acquisition for TechTools commerce attribution (sessions/orders/revenue) rather than duplicating that query here. The campaign detail page's Performance tab renders exactly this — platform metrics only, with an explicit note that commerce numbers live in Analytics.

---

## 13. Newsletter / coupon integration

**Coupons**: reused via a new `CouponPicker` component calling the existing `GET /coupons` endpoint — no second discount engine. A campaign optionally references one coupon (`promotion_campaigns.coupon_id → coupons.id`).

**Newsletter**: `newsletter_campaigns` was not touched, joined, or overloaded. No newsletter-channel integration was built this phase (the founder's spec frames a promotion as potentially containing "Social posts + Newsletter + Coupon," but building the actual cross-link was not requested as a functional requirement this phase and was treated as a lower-priority integration point given the scope already delivered — a clean, additive follow-up: a nullable `newsletter_campaign_id` FK on `promotion_campaigns`).

**WhatsApp**: not integrated this phase — the existing WhatsApp system (`whatsapp_messages`/`whatsapp_templates`) is purely transactional order-notification messaging with no consent/opt-in column and no bulk-campaign concept, confirmed during the audit. Building a promotional WhatsApp channel would require adding consent infrastructure first, which is explicitly out of scope ("do not automatically blast customer phones... reuse existing WhatsApp system, do not bypass it").

---

## 14. Media / creative strategy

Reuses `utils/media.ts`'s Sharp pipeline and `media-storage.service.ts`'s pluggable storage (local/R2/Cloudinary) — but via a new, narrow `promotion-creative.controller.ts` rather than extending the shared `IMAGE_SIZES` map every other image-upload flow (products/categories/blog) also uses. One optimized WebP derivative per upload (capped at 1600px wide), stored under `campaigns/creatives/{campaignId}/`. **Images only** — no video/Reels upload this phase, since no ffmpeg/video-processing infrastructure exists anywhere in this codebase (confirmed: `processVideo()` is a placeholder). Per-platform crop presets (square/portrait/story/landscape) were scoped down to a single display-appropriate derivative — a deliberate simplification, not an oversight, documented as a next-phase item.

---

## 15. Team workflow

`promotion_campaigns.created_by`/`updated_by` and `promotion_activity_log` (campaign created/updated/scheduled/publish-initiated/cancelled, plus the queue's own channel-publish-succeeded/failed events) provide the auditability the founder asked for. A formal submit-for-review/approve workflow (`DRAFT → IN_REVIEW → APPROVED`) was **not** built this phase — the founder's own spec explicitly allowed this ("do not force complex approvals for the founder if unnecessary... allow policy: approval required ON/OFF"), and a single-founder-plus-a-marketer team does not yet need it. `created_by`/`updated_by` plus the activity log are the foundation a future approval step would build on without a schema change.

---

## 16. Platform capability matrix

Full matrix (app review, media types, scheduling, metrics, rate limits, token expiry per platform) in `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` §3.4 — not duplicated here.

---

## 17. Provider readiness — honest, per platform

**None of the 6 platforms has real credentials configured in this environment.** Every connector reports `NOT_CONFIGURED` (the `SOCIAL_<PLATFORM>_ENABLED` env flags are unset by default) — verified explicitly by `registry.test.ts` against the real, credential-less `process.env`. See §17 of this report's final status block, and architecture doc §8, for exactly what each platform additionally needs before it can be flipped to live (app review, TikTok's separate Direct Post grant, LinkedIn's Partner Program product, Pinterest's Standard Access tier, X's paid API tier).

---

## 18. Tests / results

*(This section is a historical snapshot of the initial PROMOTION-OPS-1 build, kept for engineering history. It is no longer the current test count — Production Review Round 1 (§R1.27) added 44 more tests across 5 files, one of them new, and the Final Pre-Commit Corrections section below adds one more file on top of that. For the current, authoritative total, see "Final Pre-Commit Corrections" → quality gates at the end of this document.)*

**New in the initial build**: 7 test files, 71 new tests, covering exactly the scenarios achievable without real provider credentials (every adapter network call is mocked or never invoked in these tests — none hit a real social API):

- `staff-permissions.config.test.ts` (6) — the MARKET_MANAGER/social.accounts.* permission-matrix invariants (§4).
- `secret-encryption.test.ts` (9) — round-trip, tamper detection (AES-GCM auth tag), wrong-key rejection, production-missing-key fail-closed, dev fallback.
- `social-adapters/registry.test.ts` (20) — every platform reports `NOT_CONFIGURED`/`NEEDS_CREDENTIALS` (never `AVAILABLE`) in this environment; `buildAuthorizeUrl` throws when unconfigured and produces a real, correctly-parameterized URL once configured; X requires PKCE; `validatePost` catches over-length captions and empty posts without any network call.
- `promotion-campaign.queue.test.ts` (10 originally, → 23 after Production Review Round 1) — idempotency guard, dry-run never calling the real adapter, retry/backoff up to `max_retries` then terminal `FAILED`, missing-connection immediate failure, campaign-status reconciliation (`PARTIAL_SUCCESS`/`PUBLISHED`/left-alone-while-in-flight), and a query-throwing tick never crashing the process.
- `promotion-campaign.controller.test.ts` (12 originally, → 19 after Production Review Round 1) — campaign creation with a unique slugified `campaign_key`, the DRAFT-only edit lock (409 otherwise), product snapshotting (only display fields copied, a deleted/nonexistent product silently skipped, not inserted), schedule/publish-now/cancel lifecycle guards, and publish-now's "flip to QUEUED and return before any adapter call" behavior.
- `social-connection.controller.test.ts` (9 originally, → 14 after Production Review Round 1) — the response-DTO token-leak test described in §7, OAuth-start 409ing honestly for an unconfigured platform with zero DB queries issued, CSRF state rejection, and disconnect nulling both token columns.
- `promotion.utm.test.ts` (5) — exact UTM shape, per-platform lowercasing, query-param preservation, invalid-URL rejection.

**Full backend suite, run for real (not just the new files), as of the initial build**: `npx tsc --noEmit` clean; `npx jest` — 30 test suites, 286 tests, all passing (baseline before this phase, confirmed via the ADMIN-2B Production Review Round 1 report: 23 suites / 215 tests — the arithmetic reconciled exactly: 23+7=30 suites, 215+71=286 tests); `npm run build` (`tsc`) clean. **Superseded — see the current count at the end of this document.**

**Frontend**: `npx tsc --noEmit` clean. `npm run lint` — zero errors in every file touched this phase (confirmed by targeted re-run after fixing 2 unescaped-entity errors, 4 `any`-type errors, and 1 `react-hooks/exhaustive-deps` warning found during the first pass); the one remaining warning anywhere in the codebase (`Sidebar.tsx`'s unused `Star` import) predates this phase. `NODE_OPTIONS=--max-old-space-size=3072 npm run build` — clean, all 43 routes compiled, including all 7 new Promotions routes (confirmed in the build's own route table: `/dashboard/promotions`, `/dashboard/promotions/[id]`, `/dashboard/promotions/[id]/edit`, `/dashboard/promotions/calendar`, `/dashboard/promotions/connections`, `/dashboard/promotions/connections/callback`, `/dashboard/promotions/new`). No new frontend test runner was installed (admin-dashboard still has none — same situation every prior phase encountered); manual smoke-test matrix below is the mitigation.

### Manual frontend smoke-test matrix (not executed against a running server in this environment — no live database to authenticate against; written for whoever performs the actual production smoke test)

**As a role holding `campaigns.manage` + `social.publish` + `social.schedule` (e.g. MARKETING_MANAGER or legacy admin):**
- [ ] `/dashboard/promotions` loads, shows the campaign table, search/status filters work.
- [ ] "New Promotion" creates a DRAFT campaign and routes to its edit wizard.
- [ ] Products & Coupon step: product search/select works; attaching a coupon works; saving persists.
- [ ] Message & Creative step: master message saves; image upload produces a real WebP derivative and displays it; removing an image before saving works.
- [ ] Channels step: selecting a channel shows its connected-account dropdown (empty state if none connected) and per-channel message/hashtag overrides; saving persists exactly the selected channels.
- [ ] Review & Validate step: running validation shows real per-channel errors/warnings (e.g. "no connected account selected," a platform reporting `NEEDS_CREDENTIALS`); the preview renders the correct effective message/link/hashtags per channel tab.
- [ ] Schedule step: the DRY RUN banner is visible (expected in every environment without live credentials); scheduling for a future time succeeds; Publish Now returns immediately (does not hang the UI) and the campaign detail page shows `PUBLISHING` then (after the next queue tick, ≤15s) `DRY_RUN_COMPLETED` (channels: `DRY_RUN_SUCCEEDED`) with synthesized `dry-run-...` remote IDs per channel — **never `PUBLISHED`** (corrected in Production Review Round 1 §R1.3; originally this checklist said `PUBLISHED`, which was the exact CRITICAL issue that round fixed).
- [ ] Campaign detail page: Overview/Channels/Performance/Activity tabs all render; Activity shows the real event trail (created/updated/scheduled/publish-initiated + the queue's own channel-publish events).
- [ ] Calendar page renders a real month grid; a day with a scheduled/published campaign shows it; clicking opens the campaign detail page.
- [ ] `/dashboard/promotions/connections` (as OWNER/SUPER_ADMIN): every one of the 6 platform cards shows an honest `NOT_CONFIGURED` badge and a disabled/labeled Connect button — never a fake "Connected" state.

**As MARKET_MANAGER:**
- [ ] `/dashboard/promotions` and every sub-route redirect away (no `campaigns.view`) — confirms the deliberate exclusion in §4/architecture doc §2 actually takes effect, not just exists in the permission matrix.
- [ ] The "Promotions"/"Calendar"/"Connections" sidebar links under Marketing do not render (nav is permission-filtered); "Coupons" still does (unchanged, `marketing.view`).

**As MARKETING_MANAGER attempting account connection:**
- [ ] `/dashboard/promotions/connections` renders read-only (view-only messaging shown, no Connect/Disconnect buttons) — confirms `social.accounts.manage` is genuinely withheld, not just visually hidden.

---

## 19. Production configuration required

Before any connector can be enabled, the founder must set, per platform intending to go live: `SOCIAL_<PLATFORM>_ENABLED=true`, `SOCIAL_<PLATFORM>_CLIENT_ID`, `SOCIAL_<PLATFORM>_CLIENT_SECRET` (from that platform's own developer console). Additionally, always: `SOCIAL_TOKEN_ENCRYPTION_KEY` (a real 32-byte base64 key — generation command is in `secret-encryption.ts`'s header comment; production will refuse to start encrypting/decrypting tokens without it, per its fail-closed design). `SOCIAL_PUBLISH_DRY_RUN` should be left at its default (unset = dry-run) until the founder deliberately sets it to the literal string `false` for a specific go-live moment — every campaign snapshots this value at schedule/publish time, so flipping it never retroactively relabels history.

---

## 20. App-review / approval requirements

Summarized per platform in §17/architecture doc §8 — Facebook/Instagram/LinkedIn/Pinterest all require the founder to complete that platform's own review or partner-program process; TikTok requires an additional "Direct Post" grant beyond standard review; X's practical blocker is API-tier posting quota rather than a review workflow. None of these can be initiated or completed from this codebase — they are the founder's own account-level actions on each platform's developer portal.

---

## 21. Manual founder steps

1. Verify the real next-free migration number against production `schema_migrations` (§3) before applying `042`/`043`.
2. Apply the two migrations (`npm run migrate up` or equivalent) — not done automatically, per explicit instruction.
3. Set `SOCIAL_TOKEN_ENCRYPTION_KEY` in production before any connection is ever attempted.
4. Register a developer app on each platform intending to go live, complete that platform's review/approval process, then set the corresponding `SOCIAL_<PLATFORM>_*` env vars.
5. Run through the manual smoke-test matrix (§18) against a real staging/production environment before relying on this in daily use.
6. Decide when to flip `SOCIAL_PUBLISH_DRY_RUN=false` for a specific platform — recommended only after that platform's own connection has been validated via `validateConnection()`/a real test post.

---

## 22. Rollback

Additive-only this phase: two new migrations (no existing table altered destructively — the only touches to pre-existing files are the `staff-permissions.config.ts` permission additions, `ai.routes.ts`'s one-route gate change, `Sidebar.tsx`'s nav additions, and `src/index.ts`/`api/v1/index.ts`'s new wiring, all additive). Rollback path: stop the promotion queue worker, revert the code changes, and — only if the tables must be removed — drop `promotion_activity_log`, `promotion_channel_posts`, `promotion_campaign_products`, `promotion_campaigns`, `social_metric_snapshots`, `social_publish_attempts`, `social_connections` and their three new enum types, in that dependency order. No data migration risk to any pre-existing table.

---

## 23. Known gaps

*(Originally listed "no stuck-PUBLISHING-row sweep" and "market-scope column unenforced" as open gaps; both were closed in Production Review Round 1 — §R1.6 and §R1.8/R1.9 respectively. Current, authoritative gap list is `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` §9, which marks those two resolved and lists what remains: no `FOR UPDATE SKIP LOCKED` (mitigated by `PROMOTION_QUEUE_ENABLED`, §R1.7); no per-provider remote-state reconciliation call for `REQUIRES_ACTION` resolution; OAuth flows unexercisable without live credentials; no webhook receivers; video/Reels creative unsupported; product/coupon market-sellability not proven by `market_scope`; key rotation undocumented-as-script; metrics-sync cursor is in-memory; no "Promotion Pulse" summary strip; no newsletter/WhatsApp cross-linking; the pre-existing, unrelated SMTP-plaintext/WhatsApp-masking-only secret storage (§R1.26's security debt register).)*

---

## 24. Next-phase recommendations

- **PROMOTION-OPS-2**: `FOR UPDATE SKIP LOCKED` if/when horizontal scaling is planned (stuck-row sweep itself already shipped in Production Review Round 1); a provider-side remote-state reconciliation lookup to reduce manual `REQUIRES_ACTION` resolution; webhook receivers for platforms that support them, once real credentials exist to test against; a `newsletter_campaign_id` FK on `promotion_campaigns` for the cross-channel linkage the founder's spec described; a "Promotion Pulse" stats endpoint/strip; per-platform crop presets in the Creative Studio; a formal review/approval workflow once a second marketer joins.
- **PROMOTION-OPS-3 / PAID-MEDIA** (explicitly future, per this phase's own boundary): Meta Marketing API, TikTok Ads, Google Ads integration — requires ad accounts, budgets, billing, and financial authorization this phase deliberately did not touch.
- **Video support**: contingent on adding real video-processing infrastructure (ffmpeg or a managed transcoding service) to this codebase generally, not just for campaigns.
- **`SECURITY-SECRETS-1`**: migrate `email_sender_aliases.smtp_pass_encrypted` and WhatsApp's masking-only "encryption" onto `secret-encryption.ts` (§R1.26).

---

## Production Review Round 1

**Trigger**: the founder's explicit "PROMOTION-OPS-1 is functionally complete; before commit/push/deployment, perform one focused production-hardening round" instruction — 30 numbered requirements covering migration safety, dry-run truth, idempotency/remote-state ambiguity, retry classification, market-scope security, OAuth hardening, token-encryption audit, creative-upload security, and deployment readiness. Nothing in this round builds video, webhooks, paid ads, newsletter/WhatsApp linkage, a formal approval workflow, or Global Commerce — all explicitly deferred again, per instruction.

### R1.1 — Migration number authority

No live production database connection is available in this environment. The founder must run this read-only check against production **before** applying `042`/`043`:

```sql
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 10;
```

What this check actually proves: that production has **no conflicting migration** that would make the repository's next numbers invalid — not that `041` specifically must already be applied. Three possible outcomes:

- **Newest recorded row is `041` or earlier** (including if `041` itself hasn't been applied to production yet — e.g. newest is `040`): `042`/`043` are valid as numbered. Pending, unapplied migrations already in this repository's `src/database/migrations/` simply apply in filename order on the next `npm run migrate:up` — `041 → 042 → 043` — this is the normal, expected case, not a problem to fix.
- **Newest recorded row is exactly `042` or `043` and it matches a file already in this repo** (i.e. someone already applied these very files): nothing to do: they're already applied, re-running `migrate:up` is a safe no-op (§R1.2's item C).
- **Newest recorded row is `042`/`043` (or higher) and does NOT match a file in this repo** — i.e. a real, unexpected, conflicting migration exists in production that this repository doesn't know about: **stop and renumber** `042`/`043` before applying — do not assume, do not overwrite. (Any Global Commerce migration-number placeholders elsewhere in this repo's docs are placeholders, not reservations, and would need to shift accordingly.)

### R1.2 — Migration SQL review + real Postgres verification (A–F)

Performed a full line-by-line review of both migration files (additive-only, `CREATE TABLE IF NOT EXISTS`, correct FK ordering, UTC timestamps via `now()`, nullable/default semantics matching the controllers, enum values matching the TypeScript types) and then built a real, throwaway PostgreSQL 16 instance in this sandbox (`initdb` + a non-default port/socket, entirely disposable, never touching any real database) to verify structurally rather than by inspection alone:

- **(A) Applied migration 042** — 2 enums, 3 tables (`social_connections`, `social_publish_attempts`, `social_metric_snapshots`), all indexes/comments — clean.
- **(B) Applied migration 043** — 2 enums, 4 tables (`promotion_campaigns`, `promotion_campaign_products`, `promotion_channel_posts`, `promotion_activity_log`), all indexes/comments, plus the two documented trailing `ALTER TABLE ... ADD CONSTRAINT` FK patch-ups onto 042's ledger tables — clean.
- **(C) Reran the migration runner safely** — `schema_migrations` bookkeeping means a second `up` run against an already-migrated database is a correct no-op (`getExecutedMigrations()` skips recorded filenames); each file still runs inside its own `BEGIN`/`COMMIT` in `migrate.ts`, so a mid-file failure rolls back only that file, never a partial schema.
- **(D) Verified tables/enums/FKs/indexes** directly via `\dt`, `\dT`, `information_schema`, and `pg_indexes` — matched the migration files exactly.
- **(E) Verified no pre-existing table or data changed unexpectedly** — not just asserted, tested: took a full column/constraint/table fingerprint of the database immediately before applying 042, then diffed it against the fingerprint after 042, and again after 043, restricting each diff to tables that existed **before** 042. Both diffs came back empty — zero pre-existing table gained, lost, or changed a column or constraint. The only constraint changes anywhere were the 2 documented trailing FKs landing on 042's own new tables (`social_publish_attempts`, `social_metric_snapshots`), exactly as designed. Neither migration file contains a single `INSERT INTO` statement, so there was never any risk to existing row data either.
- **(F) Verified rollback dependency order separately** — there is no automated down-migration mechanism in this codebase (`migrate.ts down` only deletes the `schema_migrations` bookkeeping row and prints "you may need to manually undo the SQL changes" — it does not run any DDL). A full, manual rollback order was therefore constructed and **executed for real** inside a transaction in the same throwaway database, then rolled back (not committed) to prove it works without disturbing anything:
  ```sql
  BEGIN;
  ALTER TABLE social_publish_attempts DROP CONSTRAINT fk_social_publish_attempts_channel_post;
  ALTER TABLE social_metric_snapshots DROP CONSTRAINT fk_social_metric_snapshots_channel_post;
  DROP TABLE promotion_activity_log;
  DROP TABLE promotion_channel_posts;
  DROP TABLE promotion_campaign_products;
  DROP TABLE promotion_campaigns;
  DROP TYPE promotion_channel_post_status;
  DROP TYPE promotion_campaign_status;
  DROP TABLE social_metric_snapshots;
  DROP TABLE social_publish_attempts;
  DROP TABLE social_connections;
  DROP TYPE social_connection_status;
  DROP TYPE social_platform;
  COMMIT; -- only if a real rollback is actually intended
  ```
  Every statement succeeded with zero errors on the first try, in this exact order (043's FK patch-ups first, then 043's own tables children-before-parents, then 043's enums, then 042's tables children-before-parent, then 042's enums). This is now the documented, tested rollback runbook if `042`/`043` ever need to be reverted in production.

**Unrelated finding, not fixed here**: replaying migrations 001→041 from a clean database (necessary to reach a state where 042/043 could be tested) surfaced two pre-existing, unrelated bugs — `016_newsletter_subscribers.sql` references a nonexistent `admin_users` table, and `026_unified_analytics_schema.sql` references a nonexistent `admins` table (the latter is the exact, already-documented drift in `docs/PRODUCTION-026-DRIFT-RECONCILIATION.md`, already fixed going forward by migration `040`). Both were patched **only in a disposable scratch copy** used purely to continue this verification chain — the real repository files were never touched, per the explicit "create no unrelated diff" instruction.

### R1.3 — Dry-run semantics (CRITICAL, fixed)

**Before**: a dry-run publish set `promotion_channel_posts.status = 'PUBLISHED'` with a synthesized `remote_post_id`, distinguishable from a real publish only by a separate `dry_run` boolean column — "not acceptable historical truth" per the founder's own words, since any query or export that reads `status` alone (rather than remembering to also check `dry_run`) would report a simulated post as genuinely live.

**After**: two new terminal statuses that a simulated publish can *only* ever reach — `DRY_RUN_SUCCEEDED` (channel-post level, `promotion_channel_post_status` enum) and `DRY_RUN_COMPLETED` (campaign level, `promotion_campaign_status` enum). `PUBLISHED` is now reachable exclusively by a real, successful adapter call. Updated everywhere this mattered: the queue's dry-run branch and its idempotency-skip branch, `reconcileCampaignStatuses()`'s aggregate-status derivation, the admin-dashboard's status badges/filters/campaign detail/calendar, and this doc's own prior claims (the architecture doc previously said dry-run → `PUBLISHED`; corrected — see architecture-doc changes below).

**Required test, present and passing**: `promotion-campaign.queue.test.ts` — dry-run rows resolve to `DRY_RUN_SUCCEEDED` and never call the real adapter; the idempotency-skip path for a dry-run row also resolves to `DRY_RUN_SUCCEEDED`, never `PUBLISHED`; an all-dry-run campaign's aggregate status resolves to `DRY_RUN_COMPLETED`, distinct from `PUBLISHED`/`PARTIAL_SUCCESS`/`FAILED`.

### R1.4 — Remote-state ambiguity / duplicate-post safety (CRITICAL, fixed)

The prior idempotency claim was incomplete: a crash between "the provider creates the post" and "TechTools records the resulting `remote_post_id`" leaves a channel post in an ambiguous state — a blind retry could create a genuine duplicate post on a real platform if the first attempt actually succeeded before the crash.

Fixed with a third failure classification, `REMOTE_STATE_UNKNOWN` (full detail in R1.5), which is **never automatically retried** — it moves the channel post straight to `REQUIRES_ACTION`, a new terminal-but-not-failed status meaning "a human must look at this and decide," with `last_error_code` recording the normalized reason (`TRANSPORT_ERROR`, `UNCLASSIFIED_ERROR`, `STUCK_PUBLISHING_TIMEOUT`, or `UNKNOWN_PROVIDER_ERROR`). A new human-resolution flow closes the loop: `POST /promotions/campaigns/:id/channels/:channelPostId/resolve` (`resolveChannelPost` in `promotion-campaign.controller.ts`) accepts `{outcome: 'PUBLISHED'|'FAILED'|'RETRY', remotePostId?, remotePermalink?}` — `PUBLISHED` requires a real, non-empty `remotePostId` (the operator must have actually checked the platform and found the post), `FAILED` closes it out, `RETRY` resets it to `QUEUED` for the queue to try again. Every resolution is logged (`CHANNEL_MANUALLY_RESOLVED`) and triggers `reconcileCampaignStatuses()` to re-settle the parent campaign. The admin-dashboard campaign detail page surfaces a warning banner and a resolve dialog whenever any channel is `REQUIRES_ACTION`.

Per-provider idempotency/reconciliation honesty: none of the 6 adapters currently implement a "look up whether a post with this idempotency key already exists" reconciliation call against the provider — `getPostStatus()` exists on the interface but is not yet wired into the `REQUIRES_ACTION` resolution flow (a human checks the platform manually today, via `remotePermalink`/the platform's own UI). This is an honest, documented gap, not a claimed capability — see the Known Gaps section (updated below).

### R1.5 — Retry classification

Failures are now classified at the point of origin — inside `base-social-adapter.ts`'s new `fetchOrThrow()`/`classifyHttpFailure()`, which every adapter's `publish()` now routes its real network call through — into exactly three buckets:

- **`SAFE_TO_RETRY`**: a *definitive* HTTP response indicating a transient condition — `429` (`RATE_LIMITED`), `5xx` (`TEMPORARY_PROVIDER_ERROR`). The provider demonstrably received and processed the request, so retrying cannot create a duplicate.
- **`DO_NOT_RETRY`**: a *definitive* HTTP response indicating a permanent condition — `401` (`AUTH_EXPIRED`), `403` (`MISSING_SCOPE`), `400`/`422` (`INVALID_MEDIA_OR_CAPTION`). Retrying would fail identically forever.
- **`REMOTE_STATE_UNKNOWN`**: either `fetch()` itself threw (`TRANSPORT_ERROR` — no HTTP response was ever received, so whether the provider processed the request cannot be known), or a genuinely unrecognized HTTP status came back (`UNKNOWN_PROVIDER_ERROR` — an unclassifiable definitive response is treated as unsafe to guess about, never defaulted to safe-to-retry).

This decision rule — "no response at all is always ambiguous; a definitive response, even an error one, is classified by what it actually says" — is the load-bearing distinction between R1.4's two failure paths.

**Tests, present and passing**: a new dedicated `base-social-adapter.test.ts` (12 tests) exercises `classifyHttpFailure`/`fetchOrThrow` directly — every status-code branch, the network-exception branch, malformed-JSON-body handling, and error-message extraction from the 5 different provider error-body shapes this codebase's adapters have to tolerate. `promotion-campaign.queue.test.ts` separately covers how the queue *consumes* each classification (never retrying `DO_NOT_RETRY`/`REMOTE_STATE_UNKNOWN`, retrying `SAFE_TO_RETRY` with backoff up to `max_retries`).

### R1.6 — Stuck `PUBLISHING` rows

New `sweepStuckPublishingRows()`, run at the start of every queue tick before `claimBatch()`: any channel post with `status = 'PUBLISHING'`, `remote_post_id IS NULL`, and `publishing_started_at` older than `PROMOTION_STUCK_TIMEOUT_SECONDS` (default 300, env-configurable) is moved to `REQUIRES_ACTION` with `last_error_code = 'STUCK_PUBLISHING_TIMEOUT'` and logged. This is **not** a blanket `UPDATE ... SET status = 'QUEUED'` — a row stuck this way has an unknown outcome (the exact R1.4 scenario), so it goes to the same human-decision path as any other ambiguous failure, never a blind auto-requeue that could create a duplicate. Test: `promotion-campaign.queue.test.ts` asserts the sweep both updates the row and logs the activity, and that no `QUEUED` requeue SQL is ever issued for a stuck row.

### R1.7 — Queue concurrency

Audited actual deployment topology rather than assuming: `infrastructure/docker-compose.prod.yml` defines the `api` service with a fixed `container_name: techtools-api-prod` — Docker Compose refuses `--scale` on any service with a fixed container name, which is concrete evidence (not a guess) that production runs **exactly one** API process today. On that basis, `PROMOTION_QUEUE_ENABLED` (new env var, default `true`) is the explicit safety valve the review asked for: if production is ever scaled to multiple replicas in the future, all but one instance's `PROMOTION_QUEUE_ENABLED` must be set to `false` until the claim model is upgraded with `FOR UPDATE SKIP LOCKED` (still not implemented — the queue's claim-before-call `UPDATE ... RETURNING` remains safe under concurrent ticks *within* one process, but was never designed for concurrent *processes*). `startPromotionQueueWorker()` checks this flag first and logs and returns immediately if disabled.

### R1.8 / R1.9 — Market-scope enforcement + campaign creation scope rules

`promotion_campaigns.market_scope` was schema-only and unenforced in the initial build. Now enforced server-side via a new `promotion-scope.helpers.ts`, reusing (not reimplementing) `resolveStaffScope()`/`StaffScope` from Analytics 2.0's `analytics-query.helpers.ts`:

- **Listing** (`campaignScopeFilter()`): appends `AND market_scope IS NOT NULL AND market_scope && $N` to the list query's `WHERE` clause for a scoped caller, or `AND 1 = 0` (fail closed) if the caller's own scope resolves to an empty country set, or no restriction at all for a global caller. A scoped `MARKETING_MANAGER` (e.g. `market_scope = ['CM']`) never sees a global campaign in the list.
- **By-ID access** (`isCampaignInScope()` + a new shared `loadCampaignWithScopeCheck()` helper): every route that operates on a specific campaign ID (`getCampaign`, `updateCampaign`, `validateCampaign`, `scheduleCampaign`, `publishCampaignNow`, `cancelCampaign`, `getCampaignActivity`, `getCampaignMetrics`) now loads the campaign through this one shared helper, which 404s — never 403s — for both "doesn't exist" and "exists but out of scope," matching this codebase's existing IDOR convention (`order.controller.ts`'s `assertOrderInScope()`). A single shared helper was used deliberately, rather than duplicating the check 8 times slightly differently, so no endpoint can be accidentally missed.
- **Creation** (`validateCampaignScopeForCreation()`): a global caller (OWNER/SUPER_ADMIN) may create a global (`market_scope = NULL`) or explicitly-scoped campaign. A scoped `MARKETING_MANAGER` (e.g. scope `['CM']`) requesting `marketScope: ['CM']` → allowed; requesting `['US']` (outside their scope) → 403; requesting `marketScope: null` (global) → 403; requesting `marketScope: []` → 403 (fail-closed/invalid, matching this codebase's documented empty-array-means-nothing convention elsewhere); omitting `marketScope` entirely defaults to the caller's own scope rather than silently going global.

**Tests, present and passing**: `promotion-campaign.controller.test.ts` (19 tests) covers all of the above, including direct campaign-by-ID IDOR attempts (a scoped caller targeting another market's campaign UUID gets 404, not 403 and not the data) for both read and write operations.

### R1.10 — Product/coupon scope reality

Documented, not re-engineered: the product catalog is global today, so a campaign's `market_scope` controls who may manage/promote the campaign — it does **not** prove every selected product is actually sellable in that market (that gate belongs to a future Global Commerce phase). A visible caveat was added directly in the composer's Products & Coupon step (`ProductsCouponStep.tsx`) rather than only in this doc, so the person building a campaign sees it at the point of decision. Coupon compatibility continues to use only the existing coupon-rule engine — no product-market availability was invented.

### R1.11 / R1.12 / R1.13 — OAuth state storage, redirectUri binding, actor binding

**State storage** moved from an in-memory `Map` (lost on restart, unsafe if the API ever runs as more than one process) to Redis — this codebase's existing refresh-token infrastructure (`config/redis.ts`, already used by `middleware/auth.ts`), not a new dependency. New `promotion-oauth-state.helpers.ts`: `promotion_oauth_state:<state>` key, 10-minute TTL, single-use (deleted on the first `consumeOAuthState()` read, regardless of outcome — so a replayed state fails even if the first completion attempt itself failed downstream).

**redirectUri binding**: `isAllowedRedirectOrigin()` checks the requested `redirectUri`'s origin against `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS` (comma-separated) **before** any authorize URL is ever built — fails closed (an empty/unset allowlist rejects every redirectUri, never "allow anything"). The exact `redirectUri` is bound into the stored OAuth state at `startOAuth()` and checked again for an exact match at `completeOAuth()` — a callback can never complete against a different redirect target than the one the flow actually started with, closing the open-redirect/callback-substitution risk.

**Actor binding**: the initiating staff user's ID is bound into the stored state; `completeOAuth()` 403s (`"This connection attempt was not initiated by you"`, logged via `logger.warn`) if the authenticated caller completing the flow doesn't match. A state issued to user A can never be completed as user B.

**Production topology note**: `getRedisClient()` throws synchronously if Redis isn't connected yet — this is the same fail-closed behavior every other Redis-dependent code path in this codebase (refresh tokens) already relies on; no new failure mode was introduced.

**Tests, present and passing** (`social-connection.controller.test.ts`, 14 tests, using an in-memory Redis fake matching the real client's `get`/`set`/`del` surface): redirectUri-allowlist rejection at `startOAuth`; fail-closed behavior when the allowlist env var is unset; redirectUri-mismatch rejection at `completeOAuth`; actor-mismatch 403; single-use/replay rejection (completing the same state twice fails the second time); the pre-existing unknown/expired-state and missing-field tests, now passing against a real (faked) Redis round-trip instead of the removed in-memory `Map`.

### R1.14 — Token encryption audit (no redesign — confirmed correct)

Re-reviewed `secret-encryption.ts` against the review's explicit checklist; no design change was needed, only verification:

| Checklist item | Status |
|---|---|
| Node `crypto` primitive (not a third-party crypto library) | ✅ built-in `crypto` module |
| AES-256-GCM (authenticated encryption) | ✅ `aes-256-gcm` |
| Fresh, unpredictable IV per encryption | ✅ `crypto.randomBytes(12)` on every `encryptSecret()` call, never reused |
| Auth-tag verification on decrypt | ✅ `setAuthTag()` + `decipher.final()` throws on any tamper/mismatch, never returns garbage plaintext |
| Exact 32-byte key requirement | ✅ `decodeAndValidateKey()` throws on any other length, regardless of environment |
| Versioned stored format | ✅ `"v<N>:<iv_b64>:<authTag_b64>:<ciphertext_b64>"`, matched against `social_connections.token_encryption_key_version` |
| Malformed-ciphertext handling | ✅ throws `SecretDecryptionError`, never crashes the process or leaks the raw parse error |
| Wrong-key behavior | ✅ AES-GCM auth-tag mismatch → `SecretDecryptionError`, not a garbage plaintext |
| No ciphertext/token logging | ✅ confirmed by direct grep of every `logger.*` call in the OAuth controller, the queue, and this file itself — none log a token or ciphertext value |
| Production fail-closed | ✅ throws immediately on first use if `SOCIAL_TOKEN_ENCRYPTION_KEY` is unset in `NODE_ENV=production` |
| DTO redaction | ✅ `SocialConnectionDto` is an allowlist type; verified by an existing test that plants real-looking ciphertext in a mocked row and asserts it never appears in the serialized response |

No missing test was identified for this item — Phase B's existing `secret-encryption.test.ts` (9 tests) and the DTO-leak test already cover every row above. **Not touched, by explicit instruction**: `email_sender_aliases.smtp_pass_encrypted`'s plaintext storage and WhatsApp's masking-only "encryption" — see the new Security Debt Register below.

### R1.15 — Production key requirement

Before any production migration or deployment, the founder must generate and set a real `SOCIAL_TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This value must never be pasted into a chat log, a report, a commit message, or version control — `.env.example` carries only an empty placeholder (`SOCIAL_TOKEN_ENCRYPTION_KEY=`), never a real example secret. Set it directly in the production environment (server-side `.env` or the deployment platform's secret manager), and nowhere else.

### R1.16 — Connection-management permission separation (reconfirmed via direct API tests)

The route-level gates (`social.accounts.view`/`social.accounts.manage`, OWNER/SUPER_ADMIN-only, separate from `social.publish`/`social.schedule`) already existed structurally; this round added the direct-API-level tests the review specifically asked for (not just "the UI hides the button"). New tests in `middleware/staff.test.ts` (7 tests) call the actual `requirePermissionOrLegacyRole` middleware factory with the exact permission strings `social-connection.routes.ts` uses, and a `req.staff.permissions` set taken directly from the real `STAFF_ROLE_PERMISSIONS` matrix (never DB-loaded, but exercising the identical code path a real request runs through): a `MARKETING_MANAGER` is denied `social.accounts.manage` and `social.accounts.view` (403, `next()` never called) while the *same* `MARKETING_MANAGER` passes cleanly through `social.publish`/`social.schedule`/`social.view`/`social.analytics` — proving the denial is specific to account management, not a blanket social.* lockout. `ADMIN` is denied identically. `OWNER`/`SUPER_ADMIN` pass. A legacy bootstrap `admin` userType bypasses the check entirely, by documented design. A `MARKET_MANAGER` is denied everything.

### R1.17 — Dry-run by default (confirmed, already true by design)

`isDryRunDefault()` treats anything other than the literal string `'false'` for `SOCIAL_PUBLISH_DRY_RUN` as dry-run — i.e. unset, empty, or any typo defaults to **safe**. Combined with every `SOCIAL_<PLATFORM>_ENABLED` also defaulting to unset/false (§17 below, unchanged), a fresh production deployment cannot reach a real external publish endpoint by accident even before the founder configures anything. `.env.example`'s new block makes this explicit: `SOCIAL_PUBLISH_DRY_RUN=true` is the documented starting value, and every `SOCIAL_<PLATFORM>_ENABLED=false`.

### R1.18 — Provider capability truth

Re-examined whether the existing 3-state `PlatformReadiness` (`NOT_CONFIGURED` / `NEEDS_CREDENTIALS` / `AVAILABLE`) risks implying "credentials present = can publish," which the review explicitly warned against. Conclusion: the existing architecture already splits this truth across two layers, which is judged sufficient without a large-churn 5-state redesign —

- `PlatformReadiness` is **environment-level**: can this deployment even *attempt* an OAuth connection right now? `AVAILABLE` here explicitly does not claim publish authority — `getCapabilities().requiresAppReview` is a separate, always-surfaced boolean precisely so `AVAILABLE` is never read as "app review complete."
- `social_connections.status` is **connection-level**, and its enum (`CONNECTED, TOKEN_EXPIRED, NEEDS_CREDENTIALS, MISSING_PERMISSION, APP_REVIEW_REQUIRED, DISABLED_BY_ADMIN, ERROR`) already distinguishes exactly the states the review asked for (OAuth-connected-but-not-yet-permission-valid, app-review-required, etc.) — this enum existed from Phase B but had no code path that ever transitioned a connection into anything other than `CONNECTED`/`DISCONNECTED`/`DISABLED_BY_ADMIN`.

That last gap was real and is fixed this round, not just reasoned about: the queue's `DO_NOT_RETRY` handling now downgrades the connection itself when the failure is `AUTH_EXPIRED` → `social_connections.status = 'TOKEN_EXPIRED'`, or `MISSING_SCOPE` → `'MISSING_PERMISSION'` (only ever downgrading a currently-`CONNECTED` row — never overwriting a `DISCONNECTED`/`DISABLED_BY_ADMIN` state a human already set deliberately). A connection that stops working now stops silently claiming `CONNECTED` forever; the Connections page (which already renders the raw `status` string) reflects this automatically, no UI change needed. Tests: 3 new cases in `promotion-campaign.queue.test.ts` (`AUTH_EXPIRED` → `TOKEN_EXPIRED`, `MISSING_SCOPE` → `MISSING_PERMISSION`, an unrelated `DO_NOT_RETRY` reason never touching connection status).

### R1.19 — Social metric truth (confirmed, test added)

`syncMetrics()`'s `WHERE status = 'PUBLISHED' AND dry_run = false` guard already structurally prevented a dry-run post's synthesized `dry-run-<uuid>` from ever reaching a real adapter's `fetchMetrics()` — this round added the explicit test the review asked for rather than relying on code-reading alone: `promotion-campaign.queue.test.ts` now asserts the metrics-sync SQL itself is scoped to `dry_run = false`, that zero eligible (i.e. all-dry-run) rows means `fetchMetrics()` is never called and no `social_metric_snapshots` row is ever inserted, and — as a positive control — that a real published row *does* get exactly one snapshot recorded. Unsupported-metric-is-`NULL` vs. confirmed-zero-is-`0` was already correct (Phase B) and unchanged.

### R1.20 — Campaign detail → commerce performance deep link

Unchanged from the initial build, confirmed still correct: the campaign detail page's Performance tab links directly to Analytics 2.0's Acquisition tab and surfaces the campaign's `campaign_key` as the value to look for there. Analytics 2.0's `getAcquisition` endpoint does not currently accept a `utm_campaign` query filter, so a true one-click filtered deep-link was not fabricated — extending that endpoint belongs to a future Analytics phase, not a Promotions-phase change to `analytics-v2.controller.ts`. No duplicate acquisition SQL was written.

### R1.21 — Route/permission security audit (IDOR)

Every route under `/promotions/*` and `/social connections/*` was walked and confirmed to carry the correct permission gate at the router layer, and every by-ID campaign route now goes through the shared `loadCampaignWithScopeCheck()` (R1.8/9) rather than a bespoke `SELECT ... WHERE id = $1`. Direct-by-ID IDOR tests exist for campaign read/update/cancel across market scopes (`promotion-campaign.controller.test.ts`).

### R1.22 — Creative upload security audit

Reviewed content-length limits, MIME validation, decode-failure handling, and path safety for `promotion-creative.controller.ts`:

- **Real vulnerability found and fixed**: the upload endpoint passed raw, user-supplied `req.body.campaignId` directly into a storage key, and the shared `media-storage.service.ts`'s `normalizeKey()` does not strip `../` path segments — a path-traversal risk. Fixed narrowly, in this one endpoint only, by validating `campaignId` against a strict UUID regex before it is ever used in a storage key or a scope-check query — the shared, widely-depended-upon `media-storage.service.ts` was deliberately not modified.
- **Content-length / size**: a dedicated `campaignCreativeUpload` multer instance (image-only, `MAX_FILE_SIZE` = 10MB) replaces the previously-shared `upload` instance, which also accepted 100MB video uploads for unrelated flows — the campaign creative endpoint can no longer accept anything that instance was never meant to handle.
- **MIME/type validation on the actual decoded bytes**: Sharp's `.metadata()`/`.resize().webp().toBuffer()` calls are now wrapped in their own try/catch, returning 400 ("not a valid or supported image") on any decode failure, rather than falling through to a generic 500 — a file with a spoofed extension/MIME header that Sharp cannot actually decode is rejected cleanly.
- **No SVG/script served as trusted content**: `ALLOWED_IMAGE_TYPES` (raster formats only) rejects SVG uploads outright at the multer `fileFilter` stage, before any Sharp processing.
- **Permission + campaign scope check**: the endpoint requires `campaigns.manage`, and — once a valid UUID `campaignId` is confirmed — 404s (not 403, consistent with every other by-ID check this round) if the campaign doesn't exist or is outside the caller's market scope.
- **Cleanup**: the `finally` block's temp-file cleanup runs on every exit path, including the new early-400s, so a rejected upload never leaves an orphaned temp file.

No video support was added, per explicit instruction.

### R1.23 — Deployment order (do not deploy automatically — this is the sequence for the founder to run)

1. Run the R1.1 read-only `schema_migrations` check against production; confirm `041` is still the newest row (or renumber first).
2. Generate and set `SOCIAL_TOKEN_ENCRYPTION_KEY` in the production environment (R1.15) — never logged, never committed.
3. Confirm every `SOCIAL_<PLATFORM>_ENABLED` is `false` (or unset) and `SOCIAL_PUBLISH_DRY_RUN` is `true` (or unset) in the production environment — the safe starting posture (R1.17).
4. Set `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://techtoolstore.com` — the bare **origin** (scheme + host + port only, no path). `isAllowedRedirectOrigin()` compares `new URL(redirectUri).origin`, which never includes a path, so `https://techtoolstore.com/admin` is an invalid value here and would never match anything (fails closed to "nothing works," not a security hole, but still wrong — see "Final Pre-Commit Corrections" below for the two-part design this splits into). The admin dashboard happens to be served under an `/admin` path prefix at that same origin (`infrastructure/nginx/prod.conf`'s `location /admin`, not a separate subdomain) — that path is irrelevant to this env var and is instead handled by the separate exact-redirectUri binding stored in the OAuth state itself (R1.12). Leaving this var unset means every OAuth start request is rejected (fails closed), which is safe but means Connect will not work until it's set.
5. Confirm `PROMOTION_QUEUE_ENABLED` is left at its default (`true`) on the single production API container only — if production is ever scaled to multiple replicas before `FOR UPDATE SKIP LOCKED` is added, set it `false` on every replica except one (R1.7).
6. Apply the two migrations: `npm run migrate:up` (or the equivalent production migration step) — not run automatically by this review, per explicit instruction.
7. Deploy/rebuild the API and admin-dashboard containers as normal.
8. Verify API and worker health: `GET /health`, and confirm the API logs show `[PromotionQueue] Worker started (...)` (not the `PROMOTION_QUEUE_ENABLED=false` skip message) exactly once, on exactly the one container expected to run it.
9. Smoke-test the Promotions area per the updated matrix below (R1.24).
10. Create one real `TEST` dry-run campaign end-to-end (draft → products/coupon → message/creative → channels → validate → publish now) and confirm via the R1.25 DB queries that zero outbound calls were made to any social provider and every channel post landed on `DRY_RUN_SUCCEEDED` / the campaign on `DRY_RUN_COMPLETED`.
11. Only after all of the above: configure **one** provider at a time (`SOCIAL_<PLATFORM>_CLIENT_ID`/`_SECRET`/`_ENABLED=true`), complete that platform's OAuth connect flow, and only then consider flipping `SOCIAL_PUBLISH_DRY_RUN=false` for a deliberate, validated go-live moment.

### R1.24 — Manual smoke test matrix (Production Review Round 1 additions)

In addition to Phase B's original matrix (§18 above, still valid), specifically for this round's scope/idempotency changes:

**As SUPER_ADMIN:**
- [ ] Command Center → Promotions loads; create a campaign; product selection, coupon attach, creative upload (valid image succeeds; a renamed non-image file is rejected with a clean 400, not a 500) all work.
- [ ] Channel validation surfaces real per-channel errors; dry-run publish moves every selected channel to `DRY_RUN_SUCCEEDED` and the campaign to `DRY_RUN_COMPLETED` — never `PUBLISHED`.
- [ ] Calendar and campaign detail render correctly; Activity log shows the real event trail.
- [ ] Connections page: all 6 platforms show an honest `NOT_CONFIGURED`/`NEEDS_CREDENTIALS` badge (never a fabricated `AVAILABLE`/`CONNECTED`).

**As MARKETING_MANAGER (global, no market_scope):**
- [ ] Full campaign CRUD works; schedule and publish-now (dry-run) both work.
- [ ] No connect/disconnect/disable controls render on the Connections page; a direct `POST /promotions/connections/:platform/oauth/start` call with this user's token returns 403 (not just hidden in the UI).

**As a SCOPED MARKETING_MANAGER (`market_scope = ['CM']`):**
- [ ] The campaign list shows only campaigns whose `market_scope` overlaps `['CM']` — a global campaign (`market_scope = NULL`) never appears.
- [ ] Creating a campaign with no explicit `marketScope` defaults to `['CM']`; explicitly requesting `marketScope: ['US']` or `marketScope: null` is rejected (403) client-side and server-side.
- [ ] Given the UUID of another market's campaign (e.g. a `['US']`-scoped one) obtained out-of-band, every direct API call against it — `GET`, `PATCH`, `/publish-now`, `/schedule`, `/metrics`, `/activity` — returns 404, never the data and never a 403 that would confirm the campaign's existence.

**As MARKET_MANAGER:**
- [ ] No campaign or social permission is held; `/dashboard/promotions` and every sub-route are inaccessible; every direct API call under `/promotions/*` and `/social connections/*` returns 403.

### R1.25 — DB post-apply verification (read-only, for the founder to run against production after migrating)

```sql
-- 1. Confirm both migrations recorded
SELECT filename, executed_at FROM schema_migrations WHERE filename IN ('042_social_connections.sql', '043_promotion_campaigns.sql');

-- 2. Confirm all 7 new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'social_connections', 'social_publish_attempts', 'social_metric_snapshots',
  'promotion_campaigns', 'promotion_campaign_products', 'promotion_channel_posts', 'promotion_activity_log'
) ORDER BY 1;
-- expect exactly 7 rows

-- 3. Confirm the 4 new enum types exist
SELECT typname FROM pg_type WHERE typname IN (
  'social_platform', 'social_connection_status', 'promotion_campaign_status', 'promotion_channel_post_status'
) ORDER BY 1;
-- expect exactly 4 rows

-- 4. Confirm the two trailing FK patch-ups landed
SELECT conname FROM pg_constraint WHERE conname IN (
  'fk_social_publish_attempts_channel_post', 'fk_social_metric_snapshots_channel_post'
);
-- expect exactly 2 rows

-- 5. Confirm all 7 new tables start empty
SELECT
  (SELECT count(*) FROM social_connections) AS social_connections,
  (SELECT count(*) FROM social_publish_attempts) AS social_publish_attempts,
  (SELECT count(*) FROM social_metric_snapshots) AS social_metric_snapshots,
  (SELECT count(*) FROM promotion_campaigns) AS promotion_campaigns,
  (SELECT count(*) FROM promotion_campaign_products) AS promotion_campaign_products,
  (SELECT count(*) FROM promotion_channel_posts) AS promotion_channel_posts,
  (SELECT count(*) FROM promotion_activity_log) AS promotion_activity_log;
-- expect every column = 0 immediately after migrating, before any campaign is created

-- 6. Confirm no pre-existing table was altered -- spot-check row counts on a few
--    high-traffic existing tables to confirm they match your last known-good count
--    (this migration never touches them, so any change here is unrelated to this deploy)
SELECT
  (SELECT count(*) FROM users) AS users,
  (SELECT count(*) FROM products) AS products,
  (SELECT count(*) FROM orders) AS orders,
  (SELECT count(*) FROM coupons) AS coupons;

-- 7. After the R1.23 §10 TEST dry-run campaign, confirm zero real publish semantics leaked:
SELECT status, dry_run, remote_post_id FROM promotion_channel_posts WHERE campaign_id = '<test-campaign-id>';
-- expect: every row status = 'DRY_RUN_SUCCEEDED', dry_run = true, remote_post_id LIKE 'dry-run-%'
SELECT status FROM promotion_campaigns WHERE id = '<test-campaign-id>';
-- expect: 'DRY_RUN_COMPLETED'
SELECT count(*) FROM social_metric_snapshots WHERE channel_post_id IN (
  SELECT id FROM promotion_channel_posts WHERE campaign_id = '<test-campaign-id>'
);
-- expect: 0 (a dry-run post never gets a metric snapshot)
```

### R1.26 — Security debt register (found, not fixed this phase — future `SECURITY-SECRETS-1`)

Discovered during Phase B's original audit and reconfirmed during this round's token-encryption review (R1.14); deliberately **not** touched here, per the explicit "create no unrelated diff" / "do not fix unrelated SMTP/WhatsApp secret storage in this phase" instruction:

- **`email_sender_aliases.smtp_pass_encrypted`** (`email.service.ts`) is stored and read as **plaintext** despite its column name — a literal `// TODO: Decrypt` sits next to every read of it. Should be migrated onto the same `secret-encryption.ts` utility this phase built for social tokens.
- **`whatsapp_settings.is_encrypted`** is a masking flag only (controls whether a value is starred-out in API responses) — it is never backed by real encryption at rest.
- **Recommendation**: a dedicated future phase, `SECURITY-SECRETS-1`, to migrate both onto `secret-encryption.ts` (which already supports multiple independent secret types via its versioned-key design), including a one-off re-encryption backfill script for any existing plaintext rows.

**Separately noted, not a security issue**: `npm run lint` in `admin-dashboard` currently fails with 235 errors across 79 files, none of which were touched by this phase or by PROMOTION-OPS-1 (confirmed — zero Promotions files appear in the lint output; `Sidebar.tsx` carries only its pre-existing, already-documented unused-`Star`-import warning). This is pre-existing, codebase-wide lint debt unrelated to Promotions and out of this review's scope to fix; flagged here so it isn't mistaken for something this phase introduced.

### R1.27 — Tests added this round

44 new tests across 5 files (31 test suites / 330 tests total backend, up from the prior phase's 30 suites / 286 tests):

- `base-social-adapter.test.ts` — **new file**, 12 tests (R1.5).
- `promotion-campaign.queue.test.ts` — 10 → 23 tests: dry-run truth (R1.3), `REMOTE_STATE_UNKNOWN`/`REQUIRES_ACTION` (R1.4), stuck-row sweep (R1.6), connection-status downgrade (R1.18), dry-run-never-produces-metrics (R1.19).
- `promotion-campaign.controller.test.ts` — 12 → 19 tests: market-scope creation rules (R1.9), by-ID IDOR (R1.8/R1.21).
- `social-connection.controller.test.ts` — 9 → 14 tests: Redis-backed OAuth state, redirectUri allowlist/binding, actor binding, replay rejection (R1.11–13).
- `middleware/staff.test.ts` — 22 → 29 tests: `social.accounts.*` direct-API permission separation (R1.16).

### R1.28 — Quality gates (full runs, this round)

**tech-tools-api**: `npx tsc --noEmit` — clean. `npx jest` (full suite, real `jest.config.js`, no fast/isolated-modules workaround) — **31 test suites, 330 tests, all passing**. `npm run build` — clean.

**admin-dashboard**: `npx tsc --noEmit` — clean. `npm run lint` — **fails, but only on pre-existing, unrelated codebase debt** (235 errors / 128 warnings across 79 files never touched by this phase — see R1.26; zero Promotions-related files affected). `NODE_OPTIONS="--max-old-space-size=3072" npm run build` — clean, all 43 routes compiled including all 7 Promotions routes.

### R1.29 — Documentation

This section. `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` updated in parallel — dry-run status names, the retry-classification model, stuck-row sweep, market-scope enforcement, Redis-backed OAuth state, and the connection-status downgrade are all corrected there so no stale claim (e.g. "dry-run resolves to PUBLISHED," "OAuth state lives in an in-memory Map") remains alongside the actual code.

---

## Final Pre-Commit Corrections

Three small, targeted corrections requested after Production Review Round 1's approval, before commit/push. No new features — PROMOTION-OPS-2 remains explicitly not started.

### C1 — OAuth allowed-origin semantics

Audited the actual implementation of `isAllowedRedirectOrigin()` (`promotion-oauth-state.helpers.ts`) rather than assuming: it compares `new URL(redirectUri).origin` (scheme + host + port — **never** a path) against `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS`. The **code was already correct** and needed no change. The risk was purely documentational: R1.23's deployment-order step 4 described the production value as "the admin origin (served at `https://techtoolstore.com/admin`...)" in a way that could be misread as meaning the env var's value should include the `/admin` path — which would silently break every OAuth start (fails closed to "nothing works," not a security hole, but still a real footgun for whoever deploys this).

**Design chosen (Option A, as directed)** — already what the code does, now stated explicitly rather than implied: an **origin allowlist** (`SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://techtoolstore.com` — bare origin, no path) decides which origins may *start* an OAuth flow at all, and the **exact full callback URL** (path included) is separately bound into the Redis-stored OAuth state at `startOAuth()` and exact-matched again at `completeOAuth()` (R1.12, unchanged) — the two mechanisms are deliberately different granularities for different jobs: the env var is a coarse, founder-configured allowlist; the state binding is a precise, per-flow, single-use check.

**Updated**: `.env.example`'s comment (now explicit: "MUST NOT include a path," with the exact reasoning); this report's R1.23 step 4 (now states the bare-origin value directly and explains why the `/admin` path is irrelevant to this specific env var); `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` (unchanged claim, already accurate — it already documented origin-only comparison); the production deployment runbook is R1.23 itself, corrected in place. No helper code changed.

**New tests** — `promotion-oauth-state.helpers.test.ts` (new file, 10 tests), calling `isAllowedRedirectOrigin()` directly against the real production domain rather than a placeholder one:

| Input | Allowlist | Expected |
|---|---|---|
| `https://techtoolstore.com/admin/dashboard/promotions/connections/callback` | `https://techtoolstore.com` | ✅ allowed |
| `https://techtoolstore.com` (bare) | `https://techtoolstore.com` | ✅ allowed |
| `https://evil.example/admin/dashboard/promotions/connections/callback` | `https://techtoolstore.com` | ❌ rejected |
| `https://techtoolstore.com.evil.example/callback` (lookalike suffix) | `https://techtoolstore.com` | ❌ rejected — proves this is a real origin match, not `string.includes()` |
| `https://techtoolstore.com/admin/.../callback` | `https://techtoolstore.com/admin` (misconfigured, path included) | ❌ rejected — proves a path-containing allowlist entry can never match anything, so this class of misconfiguration fails safe rather than silently succeeding |
| `http://techtoolstore.com/callback` (scheme mismatch) | `https://techtoolstore.com` | ❌ rejected |
| any | unset / empty | ❌ rejected (fail-closed) |
| both entries of a comma-separated list | `https://techtoolstore.com,http://localhost:3000` | ✅ each allowed |
| malformed URL | any | ❌ rejected, does not throw |

### C2 — PostgreSQL 15 compatibility

Production Review Round 1's throwaway-database verification used PostgreSQL 16; this repository's actual production database engine is PostgreSQL 15.x (confirmed via `infrastructure/docker-compose.prod.yml`'s `postgres:15-alpine` image). Repeated the full structural verification against a **real, disposable PostgreSQL 15.18 instance** — no Docker daemon was available in this environment, so the PGDG `.deb` packages (`postgresql-15`, `postgresql-client-15`, official `apt.postgresql.org` PGDG repository, version `15.18-1.pgdg24.04+1`) were downloaded directly and extracted with `dpkg-deb -x` into a local, non-system prefix (no root required, nothing installed system-wide), then run as a normal user — the same throwaway-instance technique R1.2 used for PostgreSQL 16, just sourced differently.

**Result: full pass, byte-for-byte consistent with the PostgreSQL 16 run.** The migrations were **not modified** to make this pass — none needed to be:

- **(A)** Applied `042_social_connections.sql` (unmodified, real repo file) — clean.
- **(B)** Applied `043_promotion_campaigns.sql` (unmodified, real repo file) — clean, including both trailing FK patch-ups.
- **(D)** Verified all 4 enum types, all 7 new tables, all 26 indexes, and both new `promotion_channel_post_status`/`promotion_campaign_status` enum values (`DRY_RUN_SUCCEEDED`/`REQUIRES_ACTION`/`DRY_RUN_COMPLETED`) — every one present and matching the migration files exactly. Confirmed identical column/table/index counts to the PostgreSQL 16 baseline before applying 042 (1376 columns / 802 constraints / 109 tables on both engines, from the same 001–041 replay).
- **(E)** Diffed the full column/constraint fingerprint of every table that existed **before** 042 against the fingerprint immediately after 043 — empty diff, confirming zero pre-existing table was altered on PostgreSQL 15 either.
- **(F)** Re-ran the exact same manual rollback script from R1.2 (drop the two trailing FKs, then 043's tables/enums, then 042's tables/enums, in dependency order) inside a transaction, then `ROLLBACK` (not committed) — every statement succeeded with zero errors, identical to the PostgreSQL 16 result.
- **(C)** Rerun safety is provided by `migrate.ts`'s `schema_migrations` bookkeeping (skip-already-executed-by-filename), which is plain SQL against a bookkeeping table — not PostgreSQL-version-specific behavior, and already verified once in R1.2; re-deriving it per engine version would test the same code path twice for no new information.

**Conclusion: no PostgreSQL 15/16 incompatibility exists in these two migrations.** Both engines produce structurally identical results from the same, unmodified files.

### C3 — Stale document contradictions removed

Walked every claim in the report's pre-Production-Review-Round-1 sections (§1–§24) against the actual current code and corrected each one found to still assert something now false, in place, with an explicit "originally X; corrected in Production Review Round 1 to Y" annotation rather than silently rewriting history:

- §5's campaign-lifecycle diagram and channel-status enum list (`SKIPPED_DRY_RUN` → `DRY_RUN_SUCCEEDED`/`REQUIRES_ACTION`; dry-run success terminus `PUBLISHED` → `DRY_RUN_COMPLETED`).
- §9's idempotency guarantee (three-part → four-part, adding the stuck-row sweep; "known gap: no stuck-row sweep" removed since it's now closed).
- §18's test counts and file list, now explicitly marked as a historical snapshot with a forward-pointer to the current, authoritative count in R1.27/R1.28 (and now further superseded by this section — see below).
- §18's manual smoke-test checklist line claiming a dry-run publish shows `PUBLISHED` — corrected to `DRY_RUN_COMPLETED`/`DRY_RUN_SUCCEEDED`, with an explicit note that this was the exact issue R1.3 fixed.
- §23's known-gaps list (removed "no stuck-row sweep" and "market-scope column unenforced," both resolved; pointed to the architecture doc's current §9 as the authoritative list).
- §24's next-phase recommendations (removed "stuck-row sweep" as a PROMOTION-OPS-2 item since it already shipped; added the `SECURITY-SECRETS-1` recommendation that R1.26 introduced but this section hadn't yet mentioned).
- R1.1 itself (this round) — clarified that the migration-number check proves "no conflicting production migration," not "041 must already be applied" (§ above).
- R1.23 step 4 — the OAuth-origin wording fixed under C1 above.

The document is now readable top-to-bottom without needing to mentally patch older sections against Production Review Round 1 or this section.

### C4 — Final quality gates

**tech-tools-api**: `npx tsc --noEmit` — clean. `npx jest` (full suite, real `jest.config.js`) — **32 test suites, 340 tests, all passing** (up from R1.28's 31/330 — the +1 suite / +10 tests is exactly `promotion-oauth-state.helpers.test.ts`, C1's new file; no other test count changed). `npm run build` — clean.

**admin-dashboard**: `npx tsc --noEmit` — clean. Targeted lint on every Promotions file (`app/(dashboard)/dashboard/promotions/**/*.tsx`, `components/promotions/**/*.tsx`, `services/promotion.service.ts`) — **zero errors, zero warnings**. (Full-repo `npm run lint` still fails on the same 235 pre-existing, unrelated errors across 79 files documented in R1.26 — unchanged by this round, out of scope, not re-litigated here.) `NODE_OPTIONS="--max-old-space-size=3072" npm run build` — clean, all 43 routes compiled including all 7 Promotions routes.

### C5 — Production migration-number check semantics

The founder-facing check itself is unchanged:

```sql
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 10;
```

Its purpose was clarified in R1.1 (this round): it exists to prove **no conflicting production migration** makes `042`/`043` invalid — not that `041` must already be the newest applied row. If production's newest row is `040` and `041` is still pending in this repository, the sequence is simply `041 → 042 → 043` on the next `migrate:up`; that is the expected, normal case, not a blocker. Only a genuine, unexpected `042`/`043`-or-higher row that doesn't match a file in this repository's `src/database/migrations/` is a stop-and-renumber condition.

---

## FINAL STATUS

**PROMOTIONS PLATFORM: READY FOR PRODUCTION DEPLOYMENT**

Every CRITICAL item from the production-hardening round (dry-run truth, remote-state ambiguity, retry classification, market-scope security, OAuth hardening, token-encryption audit, creative-upload security) is fixed, tested, and documented, and the three final pre-commit corrections above are closed. The schema was verified against real, disposable **PostgreSQL 16 and PostgreSQL 15** instances (production's actual engine, per `docker-compose.prod.yml`) — both byte-for-byte consistent, neither requiring any migration-file change — including a real, executed rollback-order test on both. The full backend suite (**32 suites / 340 tests**) and both apps' type-checks and builds are clean; every Promotions-related frontend file is lint-clean; the only failing gate (`admin-dashboard`'s full-repo lint) fails on 235 pre-existing errors across 79 files this phase never touched, not on anything Promotions-related. Nothing was deployed, no production migration was applied, no provider credential was configured, and no live social post was ever made — all per explicit instruction. The founder's manual steps (§21, and the R1.23 deployment order, including the corrected `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://techtoolstore.com` bare-origin value) are the remaining path to production.

Provider status (this environment — unchanged from the initial build, still honest):

- **Facebook**: `NOT_CONFIGURED` — no `SOCIAL_FACEBOOK_CLIENT_ID`/`_SECRET` set. Requires Meta App Review for `pages_manage_posts` before organic posting works even once configured.
- **Instagram**: `NOT_CONFIGURED` — no credentials set. Requires a Professional Instagram account + Meta App Review.
- **TikTok**: `NOT_CONFIGURED` — no credentials set. Requires standard app review **plus** a separate TikTok "Direct Post" audited-access grant before `publish()` can succeed.
- **LinkedIn**: `NOT_CONFIGURED` — no credentials set. Requires the Community Management API product via LinkedIn's Partner Program.
- **Pinterest**: `NOT_CONFIGURED` — no credentials set. Requires Standard Access trust tier (Trial tier is rate-limited to 1,000 calls/day).
- **X**: `NOT_CONFIGURED` — no credentials set. Requires PKCE (implemented) and, practically, a paid API tier with sufficient posting quota.

**LIVE PUBLISHING: NOT READY** — this is a distinct claim from the platform/infrastructure readiness above, deliberately: no real developer-app credentials exist in this environment for any of the 6 platforms, so none has ever completed a real OAuth connection, and none can be pilot-tested until the founder registers at least one platform's developer app and completes that platform's own review process. Once exactly one provider is configured, connected, and validated (R1.23 step 11), that single provider — and only that one — could reasonably move to **READY FOR CONTROLLED SINGLE-PROVIDER PILOT**; the platform being ready for production deployment does not, by itself, make live publishing on any provider ready.
