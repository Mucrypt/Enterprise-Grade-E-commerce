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

```
DRAFT ──(schedule)──▶ SCHEDULED ──(queue tick, time arrives)──▶ PUBLISHING ──▶ PUBLISHED
  │                        │                                         │
  │                        │(publish-now, immediate)                 ├──▶ PARTIAL_SUCCESS
  │                        ▼                                         │
  │                    PUBLISHING                                    └──▶ FAILED
  │
  └──(cancel)──▶ CANCELLED
```

Editing (`PATCH /promotions/campaigns/:id`) is only permitted while `status = 'DRAFT'` — enforced server-side (`assertEditable()`), returns `409` otherwise, not merely hidden in the UI. Cancellation is only permitted from `DRAFT`/`SCHEDULED` (`409` once publishing has genuinely started — cancelling mid-publish would leave already-succeeded channels in an undefined state, so it isn't offered). Channel-post-level status (`DRAFT/QUEUED/PUBLISHING/PUBLISHED/FAILED/CANCELLED/SKIPPED_DRY_RUN`) is independent per channel — see the architecture doc §4 for the full reconciliation logic that derives campaign-level status from channel-level statuses.

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

Three-part guarantee: (1) a row is claimed — moved to `PUBLISHING` via an atomic `UPDATE ... RETURNING` — **before** any network call; (2) a row already carrying a `remote_post_id` is never re-published, only reconciled; (3) `social_publish_attempts` is an append-only ledger of every attempt for audit/investigation. Verified by 10 tests in `promotion-campaign.queue.test.ts`, including an explicit idempotency-guard test (a claimed row with a pre-existing `remote_post_id` never calls `adapter.publish()`), dry-run rows never calling the adapter, and campaign-status reconciliation never touching an in-flight campaign. Known gap: no stuck-row sweep for a crash mid-call — documented, not solved, in the architecture doc §9.

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

**New this phase**: 7 test files, 71 new tests, covering exactly the scenarios achievable without real provider credentials (every adapter network call is mocked or never invoked in these tests — none hit a real social API):

- `staff-permissions.config.test.ts` (6) — the MARKET_MANAGER/social.accounts.* permission-matrix invariants (§4).
- `secret-encryption.test.ts` (9) — round-trip, tamper detection (AES-GCM auth tag), wrong-key rejection, production-missing-key fail-closed, dev fallback.
- `social-adapters/registry.test.ts` (20) — every platform reports `NOT_CONFIGURED`/`NEEDS_CREDENTIALS` (never `AVAILABLE`) in this environment; `buildAuthorizeUrl` throws when unconfigured and produces a real, correctly-parameterized URL once configured; X requires PKCE; `validatePost` catches over-length captions and empty posts without any network call.
- `promotion-campaign.queue.test.ts` (10) — idempotency guard, dry-run never calling the real adapter, retry/backoff up to `max_retries` then terminal `FAILED`, missing-connection immediate failure, campaign-status reconciliation (`PARTIAL_SUCCESS`/`PUBLISHED`/left-alone-while-in-flight), and a query-throwing tick never crashing the process.
- `promotion-campaign.controller.test.ts` (12) — campaign creation with a unique slugified `campaign_key`, the DRAFT-only edit lock (409 otherwise), product snapshotting (only display fields copied, a deleted/nonexistent product silently skipped, not inserted), schedule/publish-now/cancel lifecycle guards, and publish-now's "flip to QUEUED and return before any adapter call" behavior.
- `social-connection.controller.test.ts` (9) — the response-DTO token-leak test described in §7, OAuth-start 409ing honestly for an unconfigured platform with zero DB queries issued, CSRF state rejection, and disconnect nulling both token columns.
- `promotion.utm.test.ts` (5) — exact UTM shape, per-platform lowercasing, query-param preservation, invalid-URL rejection.

**Full backend suite, run for real (not just the new files)**: `npx tsc --noEmit` clean; `npx jest` — **30 test suites, 286 tests, all passing** (baseline before this phase, confirmed via the ADMIN-2B Production Review Round 1 report: 23 suites / 215 tests — the arithmetic reconciles exactly: 23+7=30 suites, 215+71=286 tests); `npm run build` (`tsc`) clean.

**Frontend**: `npx tsc --noEmit` clean. `npm run lint` — zero errors in every file touched this phase (confirmed by targeted re-run after fixing 2 unescaped-entity errors, 4 `any`-type errors, and 1 `react-hooks/exhaustive-deps` warning found during the first pass); the one remaining warning anywhere in the codebase (`Sidebar.tsx`'s unused `Star` import) predates this phase. `NODE_OPTIONS=--max-old-space-size=3072 npm run build` — clean, all 43 routes compiled, including all 7 new Promotions routes (confirmed in the build's own route table: `/dashboard/promotions`, `/dashboard/promotions/[id]`, `/dashboard/promotions/[id]/edit`, `/dashboard/promotions/calendar`, `/dashboard/promotions/connections`, `/dashboard/promotions/connections/callback`, `/dashboard/promotions/new`). No new frontend test runner was installed (admin-dashboard still has none — same situation every prior phase encountered); manual smoke-test matrix below is the mitigation.

### Manual frontend smoke-test matrix (not executed against a running server in this environment — no live database to authenticate against; written for whoever performs the actual production smoke test)

**As a role holding `campaigns.manage` + `social.publish` + `social.schedule` (e.g. MARKETING_MANAGER or legacy admin):**
- [ ] `/dashboard/promotions` loads, shows the campaign table, search/status filters work.
- [ ] "New Promotion" creates a DRAFT campaign and routes to its edit wizard.
- [ ] Products & Coupon step: product search/select works; attaching a coupon works; saving persists.
- [ ] Message & Creative step: master message saves; image upload produces a real WebP derivative and displays it; removing an image before saving works.
- [ ] Channels step: selecting a channel shows its connected-account dropdown (empty state if none connected) and per-channel message/hashtag overrides; saving persists exactly the selected channels.
- [ ] Review & Validate step: running validation shows real per-channel errors/warnings (e.g. "no connected account selected," a platform reporting `NEEDS_CREDENTIALS`); the preview renders the correct effective message/link/hashtags per channel tab.
- [ ] Schedule step: the DRY RUN banner is visible (expected in every environment without live credentials); scheduling for a future time succeeds; Publish Now returns immediately (does not hang the UI) and the campaign detail page shows `PUBLISHING` then (after the next queue tick, ≤15s) `PUBLISHED` with synthesized `dry-run-...` remote IDs per channel.
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

Full list with rationale in `docs/SOCIAL-PUBLISHING-ARCHITECTURE.md` §9: no `FOR UPDATE SKIP LOCKED` (matches existing worker convention); no stuck-`PUBLISHING`-row sweep; OAuth flows unexercisable without live credentials; no webhook receivers; video/Reels creative unsupported (no ffmpeg in this codebase); market-scope column unenforced; key rotation undocumented-as-script (though the format supports it); metrics-sync cursor is in-memory; no "Promotion Pulse" summary strip on the list page; no newsletter/WhatsApp cross-linking.

---

## 24. Next-phase recommendations

- **PROMOTION-OPS-2**: stuck-row sweep + `FOR UPDATE SKIP LOCKED` if/when horizontal scaling is planned; webhook receivers for platforms that support them, once real credentials exist to test against; a `newsletter_campaign_id` FK on `promotion_campaigns` for the cross-channel linkage the founder's spec described; a "Promotion Pulse" stats endpoint/strip; per-platform crop presets in the Creative Studio; a formal review/approval workflow once a second marketer joins.
- **PROMOTION-OPS-3 / PAID-MEDIA** (explicitly future, per this phase's own boundary): Meta Marketing API, TikTok Ads, Google Ads integration — requires ad accounts, budgets, billing, and financial authorization this phase deliberately did not touch.
- **Video support**: contingent on adding real video-processing infrastructure (ffmpeg or a managed transcoding service) to this codebase generally, not just for campaigns.

---

## FINAL STATUS

**PROMOTIONS PLATFORM: READY FOR PRODUCTION REVIEW**

The schema, permission model, adapter architecture, encryption, scheduling/publish pipeline, UTM attribution, and composer/calendar/detail/connections UI are all real, complete, and independently tested (71 new tests, 286/286 total backend tests passing, clean type-check/lint/build on both apps). Every provider is honestly reported as `NOT_CONFIGURED` by design — no real developer-app credentials exist in this environment, and none were fabricated or assumed. Nothing was deployed, no migration was applied, and no fake connector status was ever shown. The founder's manual steps (§21) are the remaining path to a live connector.

Provider status (this environment):

- **Facebook**: `NOT_CONFIGURED` — no `SOCIAL_FACEBOOK_CLIENT_ID`/`_SECRET` set. Requires Meta App Review for `pages_manage_posts` before organic posting works even once configured.
- **Instagram**: `NOT_CONFIGURED` — no credentials set. Requires a Professional Instagram account + Meta App Review.
- **TikTok**: `NOT_CONFIGURED` — no credentials set. Requires standard app review **plus** a separate TikTok "Direct Post" audited-access grant before `publish()` can succeed.
- **LinkedIn**: `NOT_CONFIGURED` — no credentials set. Requires the Community Management API product via LinkedIn's Partner Program.
- **Pinterest**: `NOT_CONFIGURED` — no credentials set. Requires Standard Access trust tier (Trial tier is rate-limited to 1,000 calls/day).
- **X**: `NOT_CONFIGURED` — no credentials set. Requires PKCE (implemented) and, practically, a paid API tier with sufficient posting quota.
