# TIKTOK-COMMERCE-1 — TikTok Shop Channel Integration Implementation Report

**Phase:** TIKTOK-COMMERCE-1 (built after PROMOTION-OPS-1, complete and separately reported in `docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md`). Read-only/diff-mode only — no writes to TikTok, no real ad spend, no fabricated data. See `docs/TIKTOK-SHOP-INTEGRATION-ARCHITECTURE.md` for the full technical reference this report doesn't duplicate, and `docs/TIKTOK-SHOP-OPERATIONS-RUNBOOK.md` for the founder-facing go-live steps.

---

## 1. Current commerce-system audit

Performed before writing any code:

- **Products/inventory**: `products.sku` is a real column. `product_variations` exists but is not fully wired — `createProduct` never inserts into it, variation endpoints are stubs. No `supplier_id` column on `products` (linked via `supplier_products`). Authoritative inventory is the `inventory` table (`current_stock`, `reserved_stock`, generated `available_stock`); reservation happens at checkout. **Confirmed: no code path anywhere in this codebase ever decrements `inventory.current_stock`** — only `reserved_stock` is mutated. This directly shaped the inventory-diff design (§7 of the architecture doc): read/diff only, never a write.
- **Orders**: `orders`/`order_items` have no `channel`/external-order-ID column today. Materializing a TechTools order per TikTok sale would require inventing checkout/reservation/fulfilment semantics for a channel-originated order — deliberately deferred, not built speculatively (§1 of the architecture doc).
- **Webhook precedent**: `payments/payment.controller.ts`'s Stripe `handleWebhook` is the only existing inbound-webhook receiver — raw body via globally-captured `req.rawBody` (`app.ts`'s `express.json({verify})`, not path-specific, so no `app.ts` change was needed), signature check, `INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING id` idempotency gate, `switch(event.type)` dispatch. `channel-webhook.controller.ts` is a structural clone.
- **Import/preview precedent**: `036_supplier_catalogue_import.sql`'s `supplier_import_batches` (preview → committed/failed lifecycle) is the model `channel_sync_runs` is built on.
- **Encryption**: PROMOTION-OPS-1's `secret-encryption.ts` (real AES-256-GCM) was confirmed reusable — refactored into a `createSecretCipher()` factory rather than duplicated (§5 below).
- **Permissions**: `staff-permissions.config.ts`'s `social.*` split (operating vs. connecting) was confirmed as the right precedent to clone for `channels.tiktok.*`.
- **Production topology**: `infrastructure/docker-compose.prod.yml`'s fixed `container_name: techtools-api-prod` confirms exactly one API process today — the same evidence PROMOTION-OPS-1 used to justify its queue-worker safety valve; `CHANNEL_SYNC_QUEUE_ENABLED` mirrors `PROMOTION_QUEUE_ENABLED` for the same reason.
- **No pre-existing Growth/Revenue dashboard**: confirmed `docs/REVENUE-OS-1-IMPLEMENTATION-REPORT.md` does not exist, no `/dashboard/growth` route exists, no CPA/ROAS code exists anywhere in this repository. A prior "REVENUE-OS-1" spec was discussed earlier in this engagement but never executed. `docs/GLOBAL-COMMERCE-ARCHITECTURE.md` is design-only, with zero external-channel concept implemented. TIKTOK-COMMERCE-1 is the first real external-channel code in this codebase.

---

## 2. TikTok Shop API capability audit (§1 of the spec)

**Two separate TikTok API systems exist, and must not be confused**: "TikTok for Developers" (`developers.tiktok.com`, Content Posting API, already integrated in PROMOTION-OPS-1's `tiktok.adapter.ts` for organic video) vs. "TikTok Shop Partner Center" (`auth.tiktok-shops.com` / `open-api.tiktokglobalshop.com`, the commerce API this phase targets). Every table/file/env var in this phase uses a `channel`/`commerce_channel` prefix, never bare `tiktok`, specifically to keep these two systems from ever colliding in code, schema, or permissions.

**Sourcing method and its limits**: `partner.tiktokshop.com` is a JS-rendered SPA — `WebFetch` retrieves only truncated content from it. Findings below come from official-domain search-result snippets plus corroborating third-party technical guides, not a directly-read primary source. Every place this matters is flagged inline in code comments (`tiktok-shop.adapter.ts`, `tiktok-shop.types.ts`, `tiktok-shop.signing.ts`, `tiktok-shop.webhook-verify.ts`) and must be re-verified against real Partner Center documentation before this adapter is ever pointed at a live shop.

| Area | Finding | Confidence |
|---|---|---|
| Seller registration in Italy | Available as of June 1, 2026 | Confirmed (matches founder's own claim) |
| OAuth base URL | `https://auth.tiktok-shops.com` | Official-domain sourced |
| API gateway base URL | `https://open-api.tiktokglobalshop.com` | Official-domain sourced |
| HTTPS enforcement | Enforced since June 17, 2026 | Official-domain sourced |
| Access token lifetime | ~24h (86,400s) | Third-party-sourced, **unverified** |
| Refresh token lifetime | ~365 days | Third-party-sourced, **unverified** |
| Request signing | HMAC-SHA256, `app_secret + sorted_params + [body] + app_secret` | Official-domain + third-party corroborated |
| Webhook signature | `Authorization` header (no "Bearer" prefix) = `hex(HMAC-SHA256(app_secret, app_key+raw_body))`, **no timestamp/replay protection** | Confirmed and documented as a real protocol limitation — shapes §9's webhook design |
| Webhook event types | `ORDER_STATUS_CHANGE, RECIPIENT_ADDRESS_UPDATE, PACKAGE_UPDATE, PRODUCT_STATUS_CHANGE, SELLER_DEAUTHORIZATION, UPCOMING_AUTHORIZATION_EXPIRATION, CANCELLATION_STATUS_CHANGE, RETURN_STATUS_CHANGE, REVERSE_STATUS_UPDATE, PRODUCT_INFORMATION_CHANGE, PRODUCT_CREATION, PRODUCT_CATEGORY_CHANGE, PRODUCT_AUDIT_STATUS_CHANGE, INVOICE_STATUS_CHANGE` | Confirmed real |
| Finance API | Exists | Confirmed (official Partner Center pages referenced) |
| Affiliate/Creator API | Exists | Confirmed (official Partner Center pages referenced) |
| GMV Max mandatory-spend claim ("1.5–5% of revenue starting July 2026") | Could not be corroborated by a second/official source | **Explicitly unconfirmed — not built around anywhere in this codebase** |
| GMV Max Italy-specific API manageability | Not established | **Unconfirmed — GMV Max is out of scope this phase regardless** |
| App/developer review timeline | ~1–2 weeks clean, 3+ weeks for EU/Italy compliance | Third-party-sourced estimate, used only for the runbook's expectation-setting |

**Country restrictions**: not independently verified beyond the founder's own confirmation that TikTok Shop Italy seller registration is live. No code in this phase hardcodes Italy as the only supported market — `commerce_channel_accounts.market_country`/`.market_currency` are per-account fields (§26 of the spec), so a future TikTok Germany account is a second row, not a schema change.

---

## 3. Generic commerce-channel foundation (§2, §26, §27)

Two migrations (`045_commerce_channel_foundation.sql`, `046_commerce_channel_sync.sql`) — full column-level detail in the architecture doc §1. Nine new tables total: `commerce_channel_accounts`, `channel_webhook_events`, `channel_activity_log`, `channel_product_mappings`, `channel_orders`, `channel_order_items`, `channel_sync_runs`, `channel_inventory_diffs`, `channel_financial_transactions`. `channel_sku_mappings` and `channel_inventory_sync_log`, both named as candidate tables in the founder's original spec, were deliberately merged into `channel_product_mappings` and `channel_sync_runs`/`channel_inventory_diffs` respectively rather than built as separate tables — see the architecture doc §1 for why (SKU is a listing property, not a distinct dimension; a diff run's parent/child shape already covers what a separate sync-log table would).

**Migration number verification**: performed the same real-Postgres verification technique established in PROMOTION-OPS-1's own Production Review — a throwaway PostgreSQL 16 cluster (`/tmp/pgtest_sock`, port 5433, database `techtools_verify2`, already carrying migrations 001–043 from a prior verification session), brought current with migration `044` (Trending's `brand.is_featured`/`.trending_position`, unrelated to this phase but the actual next-free number at the time), then `045`/`046` applied and verified: exactly 9 new tables, zero changes to any pre-existing table/column/constraint, the one deliberate trailing FK patch (`channel_activity_log.sync_run_id → channel_sync_runs`) confirmed present, all row counts 0. The cluster was stopped after verification, not left running.

---

## 4. Connection architecture (§4, §5)

`commerce_channel_accounts` carries shop name/external ID/market/currency/status/scopes/last-validated/last-error/sync-mode. The admin UI (`/dashboard/channels/tiktok/connection`) shows exactly this, with Connect/Reconnect/Disconnect/Disable actions gated by `channels.tiktok.connections` (OWNER/SUPER_ADMIN-only — `MARKETING_MANAGER` does **not** automatically gain shop-account admin rights, mirroring PROMOTION-OPS-1's `social.accounts.manage` split). Token storage, OAuth state, redirectUri/actor binding — all detailed in the architecture doc §5, all reusing PROMOTION-OPS-1's hardened pattern rather than a weaker parallel build.

---

## 5. Encryption key separation

Refactored `secret-encryption.ts` from a single `SOCIAL_TOKEN_ENCRYPTION_KEY`-bound module into a `createSecretCipher(envVarName, devLabel, currentVersion)` factory, rather than duplicating ~160 lines of AES-256-GCM logic into a second near-identical file. The original top-level exports remain bound to a `socialTokenCipher` instance for full backward compatibility; a new `channelTokenCipher` export is bound to a separate `CHANNEL_TOKEN_ENCRYPTION_KEY` — the two domains never share a key namespace or dev-mode fallback. 6 new tests in `secret-encryption.test.ts` cover cross-domain independence (a channel-encrypted secret cannot be decrypted with the social key and vice versa); all 15 tests in the file pass.

---

## 6. Product/SKU sync, inventory diff, order import (§6, §7, §8, §9)

Full design in the architecture doc §6–§8. Headline invariants:

- **Product sync is preview/commit**, modeled on `supplier-import.controller.ts`. Preview never writes `channel_product_mappings`; commit applies the stored plan in one transaction and rejects re-committing an already-committed run.
- **Inventory diff is read-only with no commit step** — a diff report is the terminal output. Never writes to `inventory`, never calls a TikTok write endpoint (there isn't one to call — no write method exists anywhere in `TikTokShopAdapter`).
- **Order import is idempotent reconciliation**: `ON CONFLICT (channel_account_id, channel_order_id) DO UPDATE` guarantees re-importing the same order updates it in place, never duplicates it. A rolling 7-day lookback window makes every poll self-healing rather than a one-time backfill. An order with no usable gross amount is skipped and logged, never imported with a guessed zero.
- All three are automated by their own `setInterval` worker (§11 of the architecture doc), and all three are also triggerable on-demand via their respective API endpoints for a human-initiated "run now."

---

## 7. Webhook receiver (§10, §11)

`channel-webhook.controller.ts` — full design and the no-replay-protection reasoning in the architecture doc §9. Every handler only logs+flags; the one exception (`SELLER_DEAUTHORIZATION` → connection status downgrade) is narrowly scoped to the connection's own authorization state, not commerce data. 11 tests in `channel-webhook.controller.test.ts` cover signature rejection (before any DB write), missing/duplicate `tts_notification_id` handling, unknown-event 200-not-500 handling, the `SELLER_DEAUTHORIZATION` status update, and the "processing error still acknowledges 200" behavior.

---

## 8. Operations dashboard (§13, §14)

`/dashboard/channels/tiktok` — connection status card, a "Needs Attention" card (unmapped-listing count, flagged-inventory-mismatch count, `TOKEN_EXPIRED`/`NEEDS_CREDENTIALS`/`ERROR` connection status), and real cross-section counts (product mappings / orders imported / inventory mismatches) linking to their respective pages. An honest "not built yet" notice covers Finance/affiliate/ads, rather than a half-built placeholder with invented figures. No Global Command Center changes were made this phase — that cross-channel "Web Store vs. TikTok Shop, side by side" view (§14 of the founder's spec) is a natural Global Commerce integration point but was not built here, since no Global Commerce dashboard currently exists in this codebase to extend (confirmed during the audit, §1).

---

## 9. Finance/settlement, growth intelligence, affiliates, ads (§15–§23)

**Deferred, honestly, not half-built.** `channel_financial_transactions` exists in schema (migration `046`) but no code populates it this phase. Order import leaves `platform_commission_amount`/`net_amount` `NULL` rather than estimating them from discount fields that mean something different from a fee. No affiliate/creator performance view, no ads-reporting sync, no GMV Max integration, no sales-funnel view — all explicitly out of scope for this delivery, per the founder's own "no fabricated affiliate data... no fabricated ad data... no fabricated settlement fees" instruction (§35). Building any of these against invented numbers would be strictly worse than not building them, since a founder making real business decisions would be reading fiction. These become real once genuinely-verified Finance/Affiliate API access exists — no environment in this deployment currently has real TikTok developer credentials to verify against.

---

## 10. Alerts (§24)

Not built this phase. This codebase's existing alerts framework (`api/v1/alerts/`) was confirmed reusable during the audit, but no TikTok-specific alert rules (auth-expired, webhook-failing, inventory-drift, unfulfilled-orders-near-SLA, etc.) were wired into it this phase — the Overview page's "Needs Attention" card (§8) covers the same ground for now, directly on the channel dashboard, without duplicating or extending the shared alerts engine speculatively. A follow-up item, not a gap in what was promised: the founder's spec listed this as part of the full 19-item first-delivery scope, and it is the one item from that list not delivered — documented here rather than silently dropped.

---

## 11. Staff permissions, market scope, audit trail (§25, §26, §30)

8 new permissions, full grant matrix in the architecture doc §2. `channels.tiktok.connections` is OWNER/SUPER_ADMIN-only; `CATALOG_MANAGER` gets `.view`+`.products`; `ORDER_MANAGER` gets `.view`+`.orders`; nobody else gets anything by default. `channels.tiktok.orders` is market-scoped by the channel account's own `market_country` (§2 of the architecture doc explains why this differs from the existing per-row buyer-country pattern). Every write this phase can perform (product-mapping commit, order import, inventory diff) is logged to `channel_activity_log` with actor/action/metadata — the audit trail requirement.

---

## 12. Dry-run / safe sync (§28, §29)

`commerce_channel_accounts.sync_mode` is schema-constrained to `READ_ONLY`/`DIFF_ONLY` — there is no write-capable value the database even allows this phase. `CHANNEL_TIKTOK_SHOP_ENABLED=false` by default; every OAuth flow, sync worker, and webhook handler no-ops or reports `NOT_CONFIGURED` until the founder deliberately sets real credentials. `CHANNEL_SYNC_DRY_RUN=true` exists in `.env.example` as a documented safety flag for a future write-enabled phase, following the exact precedent `SOCIAL_PUBLISH_DRY_RUN` set in PROMOTION-OPS-1.

---

## 13. Tests / results

**New test files this phase** (12 files, `tech-tools-api`):

- `secret-encryption.test.ts` (modified, +6 tests) — `channelTokenCipher`/`createSecretCipher` cross-domain independence.
- `services/channels/base-channel-adapter.test.ts` — classification + readiness scenarios (clone of `base-social-adapter.test.ts`'s shape).
- `services/channels/tiktok-shop/tiktok-shop.signing.test.ts` — request-signing shape (5 tests).
- `services/channels/tiktok-shop/tiktok-shop.webhook-verify.test.ts` — valid/tampered/missing signature, including an explicit "documents the known protocol limitation: replay verifies again" test (8 tests).
- `services/channels/channel-oauth-state.helpers.test.ts` — clone of `promotion-oauth-state.helpers.test.ts` (9 tests).
- `api/v1/channels/channel-account.controller.test.ts` — DTO-leak, CSRF, actor-binding, redirect-binding, currency-validation, replay tests.
- `config/staff-permissions.config.test.ts` (modified, +8 tests) — the `channels.tiktok.*` grant-matrix invariants.
- `services/channels/channel-sync.service.test.ts` — preview/commit/inventory-diff/order-import behavior (31 tests total in the final file, including the `importOrders` suite added for order import).
- `services/channels/channel-product-sync.worker.test.ts` / `channel-inventory-diff.worker.test.ts` / `channel-order-import.worker.test.ts` — poller behavior (never commits, per-account failure isolation, tick-level crash safety).
- `api/v1/channels/channel-product.controller.test.ts` / `channel-order.controller.test.ts` — route-handler behavior.
- `api/v1/channels/channel-webhook.controller.test.ts` — 11 tests covering the full webhook-receiver behavior described in §7 above. Caught and fixed a real test-isolation bug during this phase (`jest.clearAllMocks()` doesn't clear queued `mockResolvedValueOnce` values across tests, silently shifting mocked responses onto the wrong `query()` call in later tests) — fixed by switching to `jest.resetAllMocks()` and correcting two tests' mock sequencing to match `resolveChannelAccountId()`'s actual short-circuit behavior when no `shop_id` is present.

No test hits a real TikTok API — every adapter network call is mocked or never invoked.

**Full backend suite, run for real**: `npx tsc --noEmit` clean. `npx jest` (full run, serial to avoid this sandbox's memory constraints) — **45 test suites, 473 tests, all passing**. `npm run build` (`tsc`) clean.

**Frontend**: `npx tsc --noEmit` clean (`admin-dashboard`). `npm run build` — see the final status block below for the completed result.

---

## 14. Production configuration required

Before any connection can be attempted, the founder must set, in production only:

- `CHANNEL_TIKTOK_SHOP_ENABLED=true`
- `CHANNEL_TIKTOK_SHOP_APP_KEY` / `CHANNEL_TIKTOK_SHOP_APP_SECRET` — from a registered TikTok Shop Partner Center app
- `CHANNEL_TOKEN_ENCRYPTION_KEY` — a real 32-byte base64 key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Never pasted into a chat log, report, commit message, or version control — `.env.example` carries only an empty placeholder.
- `CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS` — the admin dashboard's real origin(s), comma-separated.

`CHANNEL_SYNC_QUEUE_ENABLED` should stay at its default (`true`) unless production is ever scaled to more than one API process, in which case only one instance should run it (§11 of the architecture doc).

---

## 15. Manual founder steps

See `docs/TIKTOK-SHOP-OPERATIONS-RUNBOOK.md` for the full step-by-step. Summary:

1. Verify the real next-free migration number against production `schema_migrations` before applying `045`/`046` (same discipline as every prior phase — this environment has no live production Postgres connection to check directly).
2. Apply the two migrations.
3. Register a TikTok Shop Partner Center developer app, complete review, obtain App Key/Secret.
4. Set the production env vars in §14.
5. Connect the shop via `/dashboard/channels/tiktok/connection`, confirm market currency at the OAuth callback step.
6. Run a product-sync preview, review the diff, commit when ready.
7. Run an inventory diff, review flagged mismatches.
8. Run (or wait for the poller to run) an order import, verify imported orders look correct.
9. Verify a real webhook delivery reaches `/api/v1/channels/webhook/tiktok-shop` and is recorded in `channel_webhook_events`.
10. Review this report's known-gaps section and the architecture doc §13 before relying on this in daily operations.

---

## 16. Rollback

Additive-only this phase: two new migrations (no existing table altered — the only touches to pre-existing files are `staff-permissions.config.ts`'s permission additions, `middleware/staff.ts`'s `channel_orders` scope expression, `Sidebar.tsx`'s nav additions, `api/v1/index.ts`'s route mounts, and `src/index.ts`'s worker start/stop wiring, all additive). Rollback path: stop the three channel sync workers, revert the code changes, and — only if the tables must be removed — drop in dependency order: `channel_inventory_diffs`, `channel_sync_runs`, `channel_order_items`, `channel_orders`, `channel_financial_transactions`, `channel_product_mappings` (and their enums), then `channel_activity_log`, `channel_webhook_events`, `commerce_channel_accounts` (and `commerce_channel_account_status`). No data-migration risk to any pre-existing table.

---

## 17. Known gaps

Full list in the architecture doc §13. Headline items: no `FOR UPDATE SKIP LOCKED` for multi-instance safety (mitigated by the single-instance queue flag); Finance/affiliate/ads sync deferred pending real API credentials; no dedicated Sync History page; TikTok-specific alert rules not wired into the shared alerts framework (the Overview page's Needs Attention card is the interim coverage); adapter/signing/webhook-verification algorithms unverified against a primary TikTok source (Partner Center's own docs are unreadable to automated tools) — must be re-checked before any live connection is attempted.

---

## 18. Next-phase recommendations

- **TIKTOK-COMMERCE-1-PRODUCTION-REVIEW-1**: a focused hardening round before any real-write capability is ever considered, matching PROMOTION-OPS-1's own two-round precedent — real-Postgres migration re-verification against actual production, OAuth/webhook-replay/market-scope/token-encryption audits, retry-classification review, deployment runbook validation. **Not part of this delivery** — real-write capability must never be enabled automatically.
- Finance/Affiliate sync, once real TikTok developer credentials exist to verify against.
- Ads-reporting read-only sync (§20 of the founder's spec), GMV Max research specific to the Italy market once real Seller Center access exists.
- A dedicated Sync History page surfacing `channel_sync_runs` directly.
- TikTok-specific rules wired into the shared alerts framework.
- A Global Commerce cross-channel view (Web Store vs. TikTok Shop side by side) once a Global Commerce dashboard exists to extend.

---

## Production Review Round 1

**Trigger**: the founder's explicit "TIKTOK-COMMERCE-1 is functionally complete; perform a focused production-hardening round before commit/push/deployment" instruction — 50 numbered requirements covering order-integrity, idempotency/race safety, out-of-order events, money-model correctness, PII minimization, token security, pagination/checkpointing, retry/backoff, structural write-safety, and staff/market-scope security. **No new business features were added** — every change below is a correctness, safety, or observability fix on top of the existing read-only/diff-mode design. Real writes to TikTok remain impossible (structurally, not just by configuration) throughout.

### R1.1 — Audit of prior changes

`git status`/`git diff --stat` reviewed before any change; every file the original TIKTOK-COMMERCE-1 build touched or created was re-read directly from source (not from the prior report's own claims) before this round began. Nothing had been committed or pushed yet, so no rollback/revert was needed for this step itself.

### R1.2 — Re-verification of the TikTok Shop API contract against current official sources

Re-ran real web research (not memory) against `partner.tiktokshop.com`, `developers.tiktok.com`, and corroborating third-party integration guides. Confirmed unchanged from the original build: webhook signature = `hex(HMAC-SHA256(app_secret, app_key + raw_body))` in the `Authorization` header, no `Bearer` prefix, **no timestamp/replay protection**, `401` (not `400`) on a rejected signature, constant-time comparison required — this codebase's `tiktok-shop.webhook-verify.ts` already matched every one of these exactly. New, concrete findings incorporated this round: TikTok Shop's documented rate limit is reportedly ~50 requests/second per store per app (production) and a unified 1,000 QPH for sandbox shops; a `429` response is expected to include a `Retry-After` header, which is now honored as authoritative when present (R1.16). The exact field name for an order's own last-modified timestamp (`update_time`, assumed by analogy with the already-confirmed `create_time` field) could **not** be verified against a primary source — documented as unverified in `tiktok-shop.types.ts`, with `ChannelOrder.externalUpdatedAt` degrading safely to `null` (every update applied unconditionally) if TikTok omits it. No Finance/Affiliate/Ads functionality was added merely because documentation confirms those APIs exist — per explicit instruction, still deferred (§9 of the original report).

### R1.3 — Migration number authority

`047_commerce_channel_order_integrity.sql` follows `046_commerce_channel_sync.sql` as the next-free number in this repository's own sequence. As with every prior phase, no live production Postgres connection exists in this environment — the founder must run `SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 15;` against production before applying, per the runbook's updated step 2.

### R1.4 — Real PostgreSQL 15 verification (not just 16)

Production runs PostgreSQL 15.x; the prior build's own verification only used a throwaway PostgreSQL 16 cluster. This round built a genuine, disposable **PostgreSQL 15.18** cluster (manually extracted `.deb` packages, since Ubuntu 24.04's default apt repository only ships PostgreSQL 16 — same technique PROMOTION-OPS-1's review used) and replayed the **entire** migration chain (`001` through `047`) from empty, not just the new files on top of an assumed-correct base:

- All 44 migration files applied cleanly in filename order.
- A second run against the same database correctly reported 0 pending migrations (idempotent re-run).
- `047`'s three additions verified structurally via `\d`: `channel_orders.external_updated_at` (nullable `timestamptz`), `commerce_channel_accounts.order_import_watermark` (nullable `timestamptz`), and the new `channel_order_import_issues` table (12 columns, the `reason_code` CHECK constraint with all 6 values, the partial unique index `ux_channel_order_import_issues_open` scoped to `WHERE resolved_at IS NULL`, and both FKs).
- Rollback path tested for real inside a transaction (`DROP TABLE channel_order_import_issues; ALTER TABLE ... DROP COLUMN ...`), then rolled back (not committed) — all three statements succeeded cleanly in dependency order.
- Row counts confirmed 0 across all 10 TIKTOK-COMMERCE-1 tables post-migration — no seed data, no unexpected inserts.

**Unrelated, pre-existing finding, not fixed in real repository files**: replaying `001`→`047` from empty re-surfaced the exact `016_newsletter_subscribers.sql` (`admin_users`) / `026_unified_analytics_schema.sql` (`admins`) missing-table bug already documented in PROMOTION-OPS-1's own Production Review Round 1 (§R1.2) and in `docs/PRODUCTION-026-DRIFT-RECONCILIATION.md`. Patched **only in a disposable scratch copy** of the migrations directory used purely to continue this verification chain — the real repository files were never touched, per the same "create no unrelated diff" discipline the prior round established.

### R1.5 — CRITICAL: orders must never disappear silently

**Before**: an order whose gross amount couldn't be parsed was logged and skipped — invisible anywhere except server logs. **After**: `channel-sync.service.ts`'s `importOrders()` routes any order that cannot become a valid `channel_orders` row (missing/unparseable gross amount, missing currency, or no external order ID at all) into a new `channel_order_import_issues` table instead, via `classifyUnimportableOrder()`, with reason codes `INVALID_ORDER_AMOUNT` / `MISSING_CURRENCY` / `MALFORMED_REMOTE_ORDER`. A partial unique index (`WHERE resolved_at IS NULL`) means re-detecting the same broken order on a later poll updates the one open issue row in place rather than accumulating duplicates. The Operations Orders page now has a "Needs reconciliation" tab showing exactly this queue, with a badge count, and a "Mark resolved" action (`resolveOrderImportIssue`) that records who resolved it and why — never silently clears it. `UNMAPPED_PRODUCT`/`MISSING_REQUIRED_SKU`/`UNSUPPORTED_ORDER_STATE` remain in the schema's CHECK constraint (matching the founder's own example list) but are deliberately unreachable by this round's code — see R1.7 for why an unmapped SKU is handled differently (imported, not blocked).

### R1.6 — Order idempotency, database-enforced

Re-confirmed (not just re-asserted): `channel_orders`' `ux_channel_orders_identity` unique index on `(channel_account_id, channel_order_id)`, present since the original build, is the actual enforcement mechanism — `importOrders()`'s `INSERT ... ON CONFLICT (channel_account_id, channel_order_id) DO UPDATE` relies on it, not an application-level check alone. A duplicate delivery (poll → poll again, or poll → webhook-triggered poll) can only ever update the one existing row, never create a second.

### R1.7 — Polling/webhook race

Audited directly: the webhook receiver (`channel-webhook.controller.ts`) **never writes to `channel_orders` at all** — every handler only logs to `channel_activity_log` and, for `SELLER_DEAUTHORIZATION` only, updates the connection's own status. The only code path that ever writes an order row is `importOrders()`, itself protected by R1.6's unique constraint. There is therefore no genuine race between "a webhook arrives" and "the poller fetches the same order" to resolve — the webhook was never a second writer. This was true in the original build too; this round adds the explicit reasoning to the architecture doc and a passing regression test (`channel-webhook.controller.test.ts`'s "never mutates channel_orders... directly from a webhook" case, already present) rather than treating it as newly fixed.

### R1.8 — CRITICAL: out-of-order remote events

**Before**: every re-import of an order unconditionally overwrote its stored status/amounts with whatever the latest poll returned — a delayed/out-of-order webhook-triggered poll could regress a known-newer status back to a stale one. **After**: `channel_orders.external_updated_at` (new, R1.4) stores the channel's own last-modified timestamp when supplied (`TikTokShopOrder.update_time`, propagated through `flattenTikTokShopOrder()`). The upsert's `ON CONFLICT ... DO UPDATE ... WHERE` clause only applies the update when `EXCLUDED.external_updated_at IS NULL OR channel_orders.external_updated_at IS NULL OR EXCLUDED.external_updated_at >= channel_orders.external_updated_at` — a genuinely older event is rejected by Postgres itself (the `RETURNING` clause returns zero rows), logged as `ORDER_IMPORT_STALE_EVENT_IGNORED` in `channel_activity_log`, and its line items are left untouched (applying an older payload's items would be its own kind of regression). No invented "status ranking" was built, since TikTok's documentation doesn't support one — the only ordering signal used is the channel's own timestamp, and its absence is a documented, safe fallback (every update applied) rather than a guess.

### R1.9 — Order money model

Re-audited every normalized column: `gross_amount`/`shipping_fee_amount`/`tax_amount` come directly from the order-search API's own reported figures; `platform_commission_amount`/`net_amount` remain `NULL` always (never estimated from `seller_discount`/`platform_discount`, which are price discounts, not platform fees — a genuinely different concept). Nothing in this codebase calls `gross_amount` "revenue," "settlement," or "profit" — the Overview page's tiles are explicitly labeled "Orders imported" and "Gross Amount," and the Finance card explicitly states these figures don't exist yet. A missing/unparseable amount is never zero-filled (R1.5's issue-queue routing is the actual enforcement).

### R1.10 — Currency safety

`channel_orders.currency` is per-row, `NOT NULL`, and never aggregated across rows anywhere in this codebase (no SUM/aggregate query over `gross_amount` exists in the channels domain at all this phase). A missing currency now routes to `channel_order_import_issues` (`MISSING_CURRENCY`, R1.5) rather than being imported with a fabricated `'UNKNOWN'` sentinel, which the original build used and which this round identified as itself a data-quality risk (a downstream display could misinterpret `'UNKNOWN'` as a real ISO code). `commerce_channel_accounts.market_currency` remains per-account, confirmed via R1.13 not hardcoded anywhere.

### R1.11 — Canonical orders vs. channel orders (documented explicitly)

Confirmed and now stated plainly, in one place: **`importOrders()` only ever writes to `channel_orders`/`channel_order_items`. It has never, in this phase, created a row in the canonical `orders` table.** `channel_orders.techtools_order_id` stays `NULL` for every row this phase's code produces. No Global Command Center aggregation exists yet that could double-count a channel order as a canonical web order — confirmed by grep: no query anywhere joins or unions `channel_orders` into any `orders`-based dashboard total. This remains a deliberate deferral (checkout/reservation/fulfilment semantics for a channel-originated order are a real design decision, not invented speculatively), not an oversight.

### R1.12 — Local inventory side effect audit

Confirmed by direct code review: `importOrders()` contains no `UPDATE inventory` statement anywhere, and a structural regression test (`channel-sync.service.test.ts`'s "never writes to orders, inventory, or techtools_order_id" case) asserts this by pattern-matching every SQL statement issued during an import run. **Local TechTools inventory is NOT decremented by a TikTok sale in this phase** — stated explicitly here and in the Operations UI (the Overview page's inventory tile is labeled "Inventory mismatches," i.e. a comparison, never a claim of live sync).

### R1.13 — Product/SKU mapping integrity

Re-confirmed the existing `ux_channel_product_mappings_identity` unique index on `(channel_account_id, channel_product_id, channel_sku)` (unchanged since the original build) already enforces the requirement: a given remote SKU can appear at most once per channel account, so it can only ever map to one `product_id`. No code path matches by product title. No change was needed here — this section documents verification, not a fix.

### R1.14 — Unmapped-SKU orders are imported, not discarded

Confirmed unchanged from the original build (`importOrders()` never skips an order for having an unmapped line item — `channel_product_mapping_id` is simply `NULL` on that item) and made visible for the first time this round: `listChannelOrders` now computes a `needs_mapping` flag per order (`EXISTS (... WHERE channel_product_mapping_id IS NULL)`), exposed via `?needsMapping=true` and shown as a "Needs mapping" badge directly in the Orders table — no server log inspection required to discover it.

### R1.15 — Buyer/shipping PII minimization

Audited every column TikTok Shop data flows into: `channel_orders` stores `buyer_display_name`/`buyer_country` only — no address, phone, or email column exists anywhere in this phase's schema. `channel_order_import_issues` (new, R1.5) deliberately has **no buyer columns at all** — only `external_order_id` and a short technical reason string, so a reconciliation queue built to fix data problems doesn't itself become a second place buyer PII accumulates. `channel_webhook_events.payload` retains the full raw webhook JSON (which may include buyer fields for `ORDER_STATUS_CHANGE` events) for debugging a security-sensitive integration — audited and confirmed **no API endpoint anywhere in this codebase ever selects or exposes that column**; it is reachable only via direct database access. This is treated as adequate access control given the phase's scale, documented explicitly here rather than left implicit. `MARKETING_MANAGER` continues to hold none of the 8 `channels.tiktok.*` permissions (unchanged, re-verified by the existing `staff-permissions.config.test.ts` matrix test), so no marketing-analytics role ever gains order/buyer visibility incidentally.

### R1.16 — Rate limits and retry classification (read-only calls only)

`base-channel-adapter.ts` gained `fetchOrThrowWithRetry()` — every real network call in `tiktok-shop.adapter.ts`'s `fetchProducts()`/`fetchOrders()` pagination loops now routes through it. A `SAFE_TO_RETRY`-classified failure (429/5xx) is retried up to 3 attempts in-process, honoring a real `Retry-After` header (captured onto `ChannelSyncError.retryAfterSeconds` in `fetchOrThrow()`) when the channel supplies one, falling back to exponential backoff with jitter (`computeBackoffDelayMs()`, exported standalone and directly unit-tested) otherwise. `DO_NOT_RETRY`/`REMOTE_STATE_UNKNOWN` are never retried in-process — those classifications exist because retrying them is unsafe or pointless, unchanged from the original design. Since every retried call here is a read-only GET-equivalent with no external side effect, this is a strictly looser policy than PROMOTION-OPS-1's publish-side retry rules would ever allow, by design (§27's own explicit allowance). No busy loops: the dashboard reads exclusively from TechTools' own database, never TikTok live, on any page load.

### R1.17 — Worker concurrency

`infrastructure/docker-compose.prod.yml`'s fixed `container_name` re-confirms single-instance production topology (unchanged conclusion from the original build). On top of the existing blanket `CHANNEL_SYNC_QUEUE_ENABLED` safety valve, three new independent per-worker flags were added — `CHANNEL_PRODUCT_SYNC_WORKER_ENABLED`, `CHANNEL_ORDER_IMPORT_WORKER_ENABLED`, `CHANNEL_INVENTORY_DIFF_WORKER_ENABLED` — so one worker can be paused for investigation without stopping the other two. No distributed lock was added (would be premature for a confirmed single-instance deployment); if production is ever scaled to multiple replicas, the existing guidance stands: all but one instance's channel-worker flags must be set to `false` until a `FOR UPDATE SKIP LOCKED` claim model exists (unchanged, still-open gap, same as PROMOTION-OPS-1's own).

### R1.18 — Incremental sync / checkpoint

**Before**: every order-import poll re-fetched a fixed rolling 7-day window from "now," forever — bounded (never downloaded unbounded history) but redundant, re-fetching the same days on every tick indefinitely. **After**: `commerce_channel_accounts.order_import_watermark` (new, R1.4) persists the start time of the last **fully successful** (no partial pagination failure) import run. A poll now fetches from `watermark - 2h overlap buffer` instead of the full rolling window once a watermark exists, falling back to the original 7-day default only for a channel account's first-ever import. The 2-hour overlap absorbs clock skew and any order whose own record briefly lags its real creation time. **The watermark is never advanced after a partial pagination failure** — `channel-sync.service.ts` checks `fetchResult.complete` before touching it, so a page that failed to fetch (even after R1.16's retries were exhausted) is retried from the same starting point on the next poll, never silently skipped.

### R1.19 — Pagination failure handling

`TikTokShopAdapter.fetchOrders()`'s return type changed from a bare `ChannelOrder[]` (which could only ever represent complete success or total failure) to `FetchOrdersResult { orders, complete, error? }`. A failure partway through pagination — even after R1.16's retries are exhausted — no longer throws away the pages that DID succeed: `fetchOrders()` catches internally and returns whatever was fetched, with `complete: false`. `importOrders()` still creates a `channel_sync_runs` row and imports every order that was actually retrieved (never discarding real, already-fetched data because of a later failure), but marks the run `status = 'failed'` (rather than `'committed'`) and skips the watermark advance (R1.18). This closes a gap in the original build where a mid-pagination throw would abort before a `channel_sync_runs` row was ever created, leaving no audit trail of the attempt at all.

### R1.20 — Backfill mode

New: `importOrders(channelAccountId, triggeredBy, { fromDate })` — an explicit, human-requested historical import that bypasses the watermark/rolling-window default entirely and, deliberately, never advances the watermark itself (a one-off backfill must never interfere with the ongoing incremental checkpoint a scheduled poll relies on). Exposed via `POST /channels/orders/import` with an optional `fromDate` body field (validated as a real parseable date, rejected with 400 otherwise) and a "Backfill" dialog on the Orders page. No automatic unbounded historical ingestion was added — a backfill only ever runs when a human explicitly requests it with a specific start date.

### R1.21 — Structural write-safety proof (not just "the button is disabled")

New `tiktok-shop.no-write-methods.test.ts`: reflects over `TikTokShopAdapter`'s actual prototype and asserts (a) no method name matches a write-suggesting pattern (`push*`, `write*`, `update*` excluding the two legitimate `*AccessToken`/`*RefreshToken` OAuth methods, `create*`, `publish*`, `delete*`, etc.), and (b) the adapter's entire public method surface is exactly the 6 expected read/OAuth methods — any future addition of a write-capable method fails this test immediately rather than only being caught by a reviewer reading a diff. `getCapabilities()`'s `supportsProductWrite`/`supportsInventoryWrite`/`supportsFulfillmentWrite` are asserted `false` directly. This is the concrete evidence behind the final status block's `PRODUCT WRITE: STRUCTURALLY DISABLED` / `INVENTORY WRITE: STRUCTURALLY DISABLED` / `FULFILMENT WRITE: STRUCTURALLY DISABLED` lines.

### R1.22 — Production environment defaults (re-confirmed)

Unchanged from the original build, re-verified this round: `CHANNEL_TIKTOK_SHOP_ENABLED=false` by default, every sync worker no-ops until a real `CONNECTED` account exists, and `commerce_channel_accounts.sync_mode`'s `CHECK` constraint permits no write-capable value. No missing/typo'd environment variable can cause a real external write, because no code path exists that would perform one regardless of configuration (R1.21).

### R1.23 — Operations UI terminology audit

Re-read every string on every TikTok Shop admin page (`page.tsx`, `products/page.tsx`, `orders/page.tsx`, `connection/*`). Confirmed the word "Synchronized" appears nowhere in this UI (grepped directly) — labels are "Product mappings," "Orders imported," "Inventory mismatches," "Last Synced" (a real per-row timestamp, not a claim of live sync), and an explicit "Not built yet" notice for Finance/affiliates/ads. No fake zero metrics for an unimplemented domain — the Finance card shows no number at all, only explanatory text.

### R1.24 — External deep links

Not built this round — TikTok Shop Seller Center order/listing URL structures could not be confirmed against a primary source (same JS-rendering limitation documented throughout this phase), and inventing one would violate the explicit "only use documented/stable URLs or omit" instruction. Left as a documented gap rather than a guessed link.

### R1.25 — Order reconciliation UI

Built this round — see R1.5. The Orders page's "Needs reconciliation" tab is the concrete UI this section asked for.

### R1.26 — Sync run observability

`channel_sync_runs` (unchanged schema) already records started_at/committed_at/status/counts per run; this round's real addition is that a partial pagination failure now reliably produces a run row at all (R1.19), where before it could fail before one was ever created. A dedicated Sync History page surfacing this table directly was **not** built this round — still an open gap, listed in Known Gaps below, consistent with "document for TIKTOK-COMMERCE-2" rather than expanding scope.

### R1.27 — Staleness indicators

Not built this round as a dedicated "Last synced N minutes ago" widget — the existing `channel_orders.last_synced_at`/`channel_product_mappings.last_synced_at` per-row timestamps already avoid presenting stale data as live (R1.23), and building a dedicated staleness-threshold alerting widget without an existing Sync History surface to anchor it (R1.26) was judged premature scope expansion for this round. Documented as a next-phase item, not silently dropped.

### R1.28 — Alerts

Not expanded this round, per explicit instruction ("do not build a second alerts framework... if implementing these expands scope materially, document for TIKTOK-COMMERCE-2"). The Overview page's "Needs Attention" card (unchanged mechanism, now also surfacing R1.5's issue count) remains the interim coverage in place of new TikTok-specific rules in the shared alerts engine.

### R1.29 — Staff security / IDOR audit

**Real gap found and fixed**: `channel-order.controller.ts`'s `listChannelOrders`/`getChannelOrder` never actually called `applyMarketScope()`/`isCountryInScope()` despite `channels.tiktok.orders` already being registered in `MARKET_SCOPED_PERMISSIONS` — a market-scoped `ORDER_MANAGER` could see and fetch every channel order across every market, including by directly guessing a UUID. Fixed: both endpoints now join `commerce_channel_accounts` (aliased `ca`) and apply the existing scope helpers exactly like `order.controller.ts`'s established pattern — `listChannelOrders` filters the list query, `getChannelOrder` 404s (never 403s) for an out-of-scope order, matching this codebase's IDOR convention. The same guard was added to the two new endpoints this round introduced (`runOrderImport`'s target channel account, `resolveOrderImportIssue`'s target issue). New tests in `channel-order.controller.test.ts` cover a scoped `ORDER_MANAGER` seeing the restriction applied, and direct-by-ID IDOR attempts against both orders and issues.

### R1.30 — Market scope generality

Re-confirmed: `RESOURCE_COUNTRY_EXPRESSIONS['channel_orders']` reads `commerce_channel_accounts.market_country` generically — no `if (country === 'IT')` branch exists anywhere in this codebase (grepped directly, confirmed clean). A future TikTok Germany or Amazon-Italy channel account is just another row with its own `market_country`, requiring no code change.

### R1.31 — API response leak audit

Re-confirmed `CommerceChannelAccountDto`/`toCommerceChannelAccountDto()` (unchanged, allowlist-based) never leaks token columns. This round's new `getChannelOrder` response explicitly deletes the `market_country` join column before serializing (`delete order.market_country`) so the scope-check plumbing itself never leaks into the API response. `channel_webhook_events.payload` (raw webhook JSON) is confirmed unreachable via any endpoint (R1.15). No finance fields exist yet to leak (R1.9's deferral).

### R1.32 — Logging audit

Grepped every `logger.*` call across `services/channels/` and `api/v1/channels/` (36 call sites) — every one passes either a static string, a `channel_account_id` (a UUID, not a secret), or a caught `Error` object (which winston serializes as message + stack, never the underlying request/response body). No call site interpolates an access/refresh token, an authorization code, a signing secret, or a buyer address/phone/email field.

### R1.33 — Health checks

Not modified this round. `GET /health` is a static, zero-database-query handler used for uptime probes — the review's own instruction to "not call TikTok API on every /health request" is already satisfied (nothing in `/health` calls out to TikTok or even queries the database today), and adding channel-connection status to a load-bearing infra health check risked changing its performance/failure characteristics for a benefit the Overview dashboard already provides (connection status, per-row last-synced timestamps). Documented as a deliberate decision, not an oversight.

### R1.34 — Production smoke test (disconnected)

Not executable in this environment (no live database/server to run against — same limitation every prior phase's review has documented). The expected disconnected-state behavior is now explicit in the runbook: Overview loads and shows `NOT CONFIGURED`, Product Mappings/Orders pages show their real empty states (not fabricated placeholder data), no background TikTok API call is possible (every worker/adapter call is gated by `getReadiness() !== 'AVAILABLE'` throwing `ChannelNotConfiguredError` before any `fetch()`), and the Needs Attention card never fires "failure" language merely because no account exists yet (`needsAttention` only evaluates `unmappedCount`/`flaggedDiffCount`/`orderIssueCount`/`account.status`, all of which are `null`/absent with no connected account — falsy, no false alarm).

### R1.35 — Controlled real read-only pilot runbook

`docs/TIKTOK-SHOP-OPERATIONS-RUNBOOK.md` updated with the exact 17-step sequence this section specifies (developer app → connect → validate → fetch products → map one SKU → compare stock → import orders → reconcile against Seller Center → verify PII scoping → monitor 24–48h → only then discuss write capability), plus the new backfill/reconciliation-queue steps this round added.

### R1.36 — Reality check against Seller Center

Added to the runbook as an explicit, required manual comparison step (order count, product/mapping count, inventory figures) — this cannot be automated without real credentials, so it's documented as a founder action, not claimed as built.

### R1.37 — Finance/affiliate/ads still not implemented

Confirmed unchanged: `channel_financial_transactions` remains schema-only, no code populates it. Status lines remain `API NOT VERIFIED`/`NOT CONFIGURED` (not `NOT IMPLEMENTED`, since the underlying TikTok APIs are confirmed to exist — see the original report §2 — only this deployment's access to them is unverified). The Overview page's Finance card wording was re-checked and confirmed to never imply these systems exist today.

### R1.38 — Test matrix

New/updated test coverage this round (in addition to the 55 pre-existing channel tests, which all still pass unmodified except where behavior genuinely changed): out-of-order/stale-event handling, watermark-based checkpointing (uses watermark when present, falls back to rolling window, never advances on partial failure or during a backfill), backfill mode, partial-pagination-failure handling (orders fetched before the failure are still applied; the run is marked `failed`; the watermark doesn't move), the three `channel_order_import_issues` reason codes, retry-with-backoff (successful retry, no retry for `DO_NOT_RETRY`, gives up after max attempts, honors a real `Retry-After` header), `computeBackoffDelayMs()`'s pure-function behavior, the structural no-write-methods proof, and IDOR/market-scope tests for every order/issue endpoint. No test calls a real TikTok API — every adapter network call remains mocked.

### R1.39 — Quality gates

`tech-tools-api`: `npx tsc --noEmit` clean. `npx jest` (full suite, run serially given this sandbox's memory constraints) — **46 test suites, 506 tests, all passing** (up from 45/473 before this round). `npm run build` clean. `admin-dashboard`: `npx tsc --noEmit` clean. `NODE_OPTIONS="--max-old-space-size=3072" npm run build` — see this report's own build log for the exact route table; all 5 TikTok admin routes compile.

### R1.40 — Documentation updates

This section. `docs/TIKTOK-SHOP-INTEGRATION-ARCHITECTURE.md` updated with the R1.5–R1.20 mechanisms (order-import checkpointing, out-of-order protection, the issue-reconciliation table, retry/backoff) and the R1.29 IDOR fix. `docs/TIKTOK-SHOP-OPERATIONS-RUNBOOK.md` updated with the R1.35/R1.36 runbook additions and a troubleshooting-table entry for stale/reconciliation states. No stale contradictions (e.g. the original "skips... with no guessed value" language around bad amounts) were left in place — updated to reflect the issue-queue behavior everywhere it was previously described as a silent skip.

---

## Final status

```
TIKTOK COMMERCE PLATFORM: READY FOR READ-ONLY PRODUCTION PILOT

PRODUCTION MIGRATIONS:      READY            (045/046/047 verified structurally on real PostgreSQL 15.18 and 16;
                                                founder must still confirm the real next-free number against
                                                production schema_migrations before applying -- no live
                                                production connection exists in this environment)
REAL SHOP CONNECTION:       READY FOR FOUNDER CONFIGURATION
                                              (OAuth/token-encryption/CSRF/redirect/actor-binding code complete
                                               and tested; no real TikTok developer credentials exist in this
                                               environment)
PRODUCT READ:               READY            (preview sync, real SKU matching, retry/backoff on rate limits,
                                                worker-automated)
PRODUCT WRITE:               STRUCTURALLY DISABLED   (no write method exists anywhere in the adapter -- proven
                                                        by reflection-based regression test, not just a disabled
                                                        button or unset flag)
ORDER IMPORT:                READY            (idempotent upsert, database-enforced uniqueness, out-of-order-event
                                                 protection, checkpoint/watermark-based incremental sync, explicit
                                                 backfill mode, retry/backoff, worker-automated + manual trigger)
ORDER RECONCILIATION:        READY            ("Needs reconciliation" queue -- a real order that cannot be safely
                                                 normalized is recorded and surfaced, never silently dropped)
LOCAL INVENTORY EFFECT:      NONE -- confirmed by a structural regression test that no import path ever issues an
                                     UPDATE against the inventory table. TechTools inventory is not decremented by
                                     a TikTok sale in this phase; the Operations UI never implies otherwise.
TIKTOK INVENTORY WRITE:      STRUCTURALLY DISABLED   (schema's sync_mode CHECK constraint permits no write-capable
                                                        value; no write endpoint is ever called)
FULFILMENT WRITE:            STRUCTURALLY DISABLED   (no fulfilment-write code exists anywhere this phase)
FINANCE:                     API NOT VERIFIED  (Finance API confirmed to exist; channel_financial_transactions
                                                  remains schema-only, populated by no code this phase)
AFFILIATE:                   API NOT VERIFIED  (Affiliate API confirmed to exist; not built this phase)
ADS:                         NOT CONFIGURED    (not built this phase)
LIVE EXTERNAL WRITES:        DISABLED          (structurally -- see PRODUCT/INVENTORY/FULFILMENT WRITE lines above)
```

Every "READY" line above describes tested, complete, real code that currently has nothing real to connect to in this environment (no TikTok developer credentials exist here). A real TikTok order cannot be silently skipped by this code: every fetched order either becomes a `channel_orders` row, updates one that already exists, is correctly ignored as a stale/out-of-order duplicate (and logged as such), or is recorded in the `channel_order_import_issues` reconciliation queue — there is no fourth outcome. REAL SHOP CONNECTION flips to CONNECTED, and the rest of this list becomes operationally live, only once the founder completes the manual steps in `docs/TIKTOK-SHOP-OPERATIONS-RUNBOOK.md`.
