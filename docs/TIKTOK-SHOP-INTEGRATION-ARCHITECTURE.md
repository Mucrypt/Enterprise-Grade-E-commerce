# TikTok Shop Integration Architecture (TIKTOK-COMMERCE-1)

Technical reference for the generic commerce-channel platform and its first concrete implementation, TikTok Shop. Paired with `docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md`, which covers the phase narrative, audit findings, and test/gate results — this document is the durable "how it works" reference for whoever next touches this code, including a future second channel (Amazon, eBay, Meta Shop).

**Critical naming discipline**: this phase is unrelated to PROMOTION-OPS-1's `social_connections`/`tiktok.adapter.ts` (the "TikTok for Developers" Content Posting API used for organic video). Every table/file/env var here uses a `channel`/`commerce_channel` prefix, never bare `tiktok`, and nothing in this domain imports from or writes to `social_connections`.

---

## 1. Domain model

Two migrations, split by dependency direction:

- **`045_commerce_channel_foundation.sql`** — the connection/webhook/audit domain, zero dependency on sync tables: `commerce_channel_account_status` enum, `commerce_channel_accounts`, `channel_webhook_events`, `channel_activity_log`.
- **`046_commerce_channel_sync.sql`** — the sync/order domain, with FKs into `045`'s `commerce_channel_accounts`: `channel_product_mapping_status`, `channel_inventory_diff_action`, `channel_financial_transaction_type` enums; `channel_product_mappings`, `channel_orders`, `channel_order_items`, `channel_sync_runs`, `channel_inventory_diffs`, `channel_financial_transactions`. Ends with one `ALTER TABLE channel_activity_log ADD CONSTRAINT ... FOREIGN KEY (sync_run_id) REFERENCES channel_sync_runs(id)` — the one deliberate forward-reference patch, since `045` predates the table it eventually points to (the same pattern PROMOTION-OPS-1 used for its own two-migration split).
- **`047_commerce_channel_order_integrity.sql`** (Production Review Round 1) — additive-only order-integrity hardening: `channel_orders.external_updated_at` (out-of-order-event detection, §8), `commerce_channel_accounts.order_import_watermark` (incremental-sync checkpoint, §8), and the new `channel_order_import_issues` table (§8a). Verified structurally on both real PostgreSQL 16 and 15.18, including a full `001`→`047` replay from empty and a transactional rollback test.

```
commerce_channel_accounts 1──* channel_product_mappings *──? products (SET NULL)
        │  │                          │
        │  │                          └──* channel_order_items *──1 channel_orders
        │  │
        │  ├──* channel_orders (techtools_order_id nullable, unpopulated this phase)
        │  ├──* channel_sync_runs 1──* channel_inventory_diffs *──1 channel_product_mappings
        │  ├──* channel_webhook_events
        │  ├──* channel_activity_log *──? channel_sync_runs
        │  └──* channel_financial_transactions *──? channel_orders (schema only, unpopulated)
```

**Why `channel_sku` lives on `channel_product_mappings` instead of a separate SKU-mapping table**: a TikTok SKU is a property of one listing, and `product_variations` (this codebase's variant table) is schema-ready but not live — createProduct never inserts into it. A second mapping table keyed off a table with no real rows would be speculative. `channel_variation_id` exists as a nullable column, populated only once variants are genuinely wired.

**Why inventory diffs use a dedicated `channel_inventory_diffs` detail table rather than a JSONB blob on `channel_sync_runs`**: the ops UI needs to list/filter individual flagged SKU mismatches (`WHERE action_taken = 'FLAGGED'`), which a JSONB array on the parent run would make unindexable. `channel_sync_runs.run_type = 'INVENTORY_DIFF'` rows still exist as the parent audit record; `channel_inventory_diffs` is the per-SKU detail, matching the parent/child shape `channel_orders`/`channel_order_items` already uses for the same reason.

**`channel_type` is `TEXT` with a `CHECK` constraint, not a Postgres `ENUM`**: a `CHECK (channel_type IN ('TIKTOK_SHOP'))` is far cheaper to extend for a future Amazon/eBay channel (one migration adding a value to the `CHECK` list) than `ALTER TYPE ... ADD VALUE` semantics. Every other status-style column that this phase controls end-to-end (`commerce_channel_accounts.status`, `.sync_mode`, `channel_sync_runs.run_type`/`.status`, `channel_product_mappings.mapping_status`, `channel_inventory_diffs.action_taken`) uses the same `TEXT + CHECK` pattern for the same reason — mirrors `social_connections.status`'s real ENUM only where PROMOTION-OPS-1 chose one; here `commerce_channel_account_status` is the one genuine ENUM, kept because its value set (`DISCONNECTED, CONNECTED, TOKEN_EXPIRED, NEEDS_CREDENTIALS, APP_REVIEW_REQUIRED, DISABLED_BY_ADMIN, ERROR`) is a direct structural clone of `social_connection_status` and equally unlikely to need frequent extension.

**`commerce_channel_accounts.sync_mode`** — `CHECK (sync_mode IN ('READ_ONLY', 'DIFF_ONLY'))`. There is currently no write-capable value the schema even allows — this is the literal database-level enforcement of "Phase 1 never writes to TikTok," not just an application-layer convention.

**`channel_orders`/`channel_order_items` never touch `orders`/`order_items`**: `channel_orders.techtools_order_id` is a nullable FK to `orders` that no code this phase ever populates. Materializing a real TechTools order per TikTok sale requires deciding checkout/reservation/fulfilment semantics for a channel-originated order — a decision deliberately deferred, not invented speculatively, exactly as `channel_orders.channel_order_status` (a raw TikTok status string) is never coerced into TechTools' own `order_status` enum. The two systems have genuinely different state machines.

**Inventory stays one-directional and read-only**: the audit for this phase confirmed no code path anywhere in this codebase decrements `inventory.current_stock` — only `reserved_stock` is ever mutated, at checkout. `channel_inventory_diffs` compares real `inventory.available_stock` against TikTok-reported stock and flags mismatches (`action_taken = 'FLAGGED'`) for a human — it never writes to `inventory` and never calls a TikTok write endpoint. `WRITTEN_TO_CHANNEL` exists in the `action_taken` CHECK constraint as schema-readiness for a future write-enabled phase; no code shipped this phase can ever produce it.

---

## 2. Permission model

Eight new permissions in `tech-tools-api/src/config/staff-permissions.config.ts`:

| Permission | Meaning |
|---|---|
| `channels.tiktok.view` | See connection status, capabilities |
| `channels.tiktok.products` | Product/SKU mappings, inventory diff (preview + commit) |
| `channels.tiktok.orders` | Imported channel orders |
| `channels.tiktok.fulfillment` | Schema-ready, unused this phase (no fulfilment-write code exists) |
| `channels.tiktok.finance` | Schema-ready, unused this phase (finance sync deferred) |
| `channels.tiktok.manage` | Reserved for cross-cutting/administrative sync operations |
| `channels.tiktok.connections` | Connect/disconnect/disable the shop account |
| `channels.tiktok.analytics` | Reserved for a future channel-analytics surface |

**Grant matrix:**

| Role | `.view` | `.products` | `.orders` | `.fulfillment` | `.finance` | `.manage` | `.analytics` | `.connections` |
|---|---|---|---|---|---|---|---|---|
| OWNER, SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| CATALOG_MANAGER | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ORDER_MANAGER | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MARKET_MANAGER, MARKETING_MANAGER, SUPPORT_AGENT | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Same split PROMOTION-OPS-1 established for `social.*`: operating the channel is broad operational access ADMIN already holds elsewhere; connecting/disconnecting the shop account itself (`channels.tiktok.connections`) is grouped with this codebase's other sensitive-configuration permissions (`social.accounts.manage`, `settings.*`, `security.*`, `staff.manage`), OWNER/SUPER_ADMIN-only. A regression test in `staff-permissions.config.test.ts` asserts `MARKET_MANAGER` holds none of the 8 new permissions and that `.connections` is never granted outside OWNER/SUPER_ADMIN.

**Commit stays under `.products`, not `.manage`**: `POST /channels/products/commit-sync` is gated by `channels.tiktok.products`, the same permission as preview — not the broader `.manage`. `.manage` is reserved for cross-cutting/administrative operations; gating commit behind it would have made it impossible for a `CATALOG_MANAGER` (who only holds `.view`+`.products`) to ever actually apply a product sync they were explicitly granted permission to work on. This was caught and fixed during self-review before this phase's first commit.

**Market scoping**: `channels.tiktok.orders` is added to `MARKET_SCOPED_PERMISSIONS`, with a new `RESOURCE_COUNTRY_EXPRESSIONS['channel_orders'] = 'LOWER(ca.market_country)'` entry in `middleware/staff.ts`. This scopes by the channel **account's own** market (`commerce_channel_accounts.market_country`), not a per-order buyer country — a deliberate departure from the existing row-level pattern, since a TikTok Shop account is registered to one seller market and every order under it inherits that market, unlike a web-store order whose buyer country varies row-by-row.

**IDOR guard, actually wired (Production Review Round 1 §29/§37/§38)**: registering `channel_orders` in `MARKET_SCOPED_PERMISSIONS` is necessary but not sufficient — the original build never actually called `applyMarketScope()`/`isCountryInScope()` from `channel-order.controller.ts`, so a scoped `ORDER_MANAGER` could see and fetch every channel order across every market, including by guessing a UUID directly. Fixed: `listChannelOrders`/`getChannelOrder`/`runOrderImport`/`listOrderImportIssues`/`resolveOrderImportIssue` all now join `commerce_channel_accounts` (aliased `ca`) and apply the scope helpers, following `order.controller.ts`'s established convention exactly — list queries filter, by-ID routes 404 (never 403) for an out-of-scope resource. Covered by IDOR-specific tests in `channel-order.controller.test.ts`.

---

## 3. Adapter architecture

`tech-tools-api/src/services/channels/`:

```
channel-account.types.ts          — ChannelAdapter interface, ChannelCapabilities, ChannelReadiness,
                                     ChannelConnectionCreds, ChannelProductSku, ChannelOrder/ChannelOrderLine,
                                     ChannelSyncError/ChannelSyncFailureClassification
base-channel-adapter.ts           — shared readiness/capability-reporting + fetchOrThrow()/classifyHttpFailure()
registry.ts                       — getChannelAdapter(channelType), getAllChannelCapabilities()
channel-oauth-state.helpers.ts    — Redis-backed OAuth state (prefix commerce_channel_oauth_state:)
channel-sync.service.ts           — previewProductSync/commitProductSync/runInventoryDiff/importOrders
channel-product-sync.worker.ts    — setInterval poller, calls previewProductSync only
channel-inventory-diff.worker.ts  — setInterval poller, calls runInventoryDiff
channel-order-import.worker.ts    — setInterval poller, calls importOrders
tiktok-shop/
  tiktok-shop.types.ts             — raw TikTok Shop response shapes + flatten*() normalizers
  tiktok-shop.signing.ts           — outbound API request signing (HMAC-SHA256)
  tiktok-shop.webhook-verify.ts    — inbound webhook signature verification (separate HMAC scheme)
  tiktok-shop.adapter.ts           — TikTokShopAdapter implements ChannelAdapter
```

One `ChannelAdapter` interface (`buildAuthorizeUrl`, `exchangeCodeForToken`, `refreshAccessToken`, `fetchProducts`, `fetchOrders`), one class per channel — `TikTokShopAdapter` is the only implementation this phase; a future Amazon/eBay adapter implements the same interface, so no caller (controllers, workers, `channel-sync.service.ts`) ever branches on channel type. `getChannelAdapter()` is the one place that maps `ChannelType → ChannelAdapter`.

**Base URLs and endpoint uncertainty**: `TIKTOK_SHOP_AUTH_BASE_URL = https://auth.tiktok-shops.com`, `TIKTOK_SHOP_API_BASE_URL = https://open-api.tiktokglobalshop.com` — the non-US ("Global Partner Portal") base URLs, matching this deployment's Italy-registered shop. Every endpoint path, parameter name, and response shape in `tiktok-shop.adapter.ts`/`tiktok-shop.types.ts` is sourced from official-domain search results plus corroborating third-party integration guides — Partner Center's own documentation site is a JS-rendered SPA that returns only truncated content to automated fetch tools, so **none of this has been verified against a raw primary-source code sample or real test vectors**. Every uncertain path/param is flagged inline in the adapter's own comments. This must be re-verified against Partner Center directly (ideally TikTok's own Postman collection) once real developer credentials exist, **before** the adapter is ever pointed at a live shop.

---

## 4. Failure classification and retry/backoff

Direct parallel to PROMOTION-OPS-1's `PublishFailureClassification`, reused by name (not import) since this is a separate domain with the same shape:

- **`SAFE_TO_RETRY`** — a definitive HTTP response indicating a transient condition: `429` → `RATE_LIMITED`, `5xx` → `TEMPORARY_PROVIDER_ERROR`.
- **`DO_NOT_RETRY`** — a definitive HTTP response indicating a permanent condition: `401` → `AUTH_EXPIRED`, `403` → `MISSING_SCOPE`, `400`/`422` → `INVALID_PRODUCT`.
- **`REMOTE_STATE_UNKNOWN`** — either `fetch()` itself threw (`TRANSPORT_ERROR`, no HTTP response was ever received) or an unrecognized status came back (`UNKNOWN_REMOTE_STATE`) — never auto-retried, since whether the request was processed cannot be known.

Implemented once in `BaseChannelAdapter.fetchOrThrow()`/`classifyHttpFailure()`, which every adapter method routes its real network call through.

**Retry/backoff (Production Review Round 1 §16/§26/§27)**: `fetchOrThrowWithRetry()` wraps `fetchOrThrow()` and retries a `SAFE_TO_RETRY` failure up to 3 attempts in-process, before ever surfacing it to the caller. Safe to do here specifically because every call this adapter makes is a read-only GET-equivalent with no external side effect — retrying cannot create a duplicate or a partial write, unlike PROMOTION-OPS-1's publish-side calls, which deliberately do NOT retry in-process for that reason. A real `429` response's `Retry-After` header is captured in `fetchOrThrow()` (`res.headers.get('retry-after')`) onto `ChannelSyncError.retryAfterSeconds` and is authoritative when present; otherwise `computeBackoffDelayMs()` (exported standalone, directly unit-tested) computes exponential backoff with jitter (attempt 1 ≈ 1s, 2 ≈ 2s, 3 ≈ 4s, capped at 8s). `DO_NOT_RETRY`/`REMOTE_STATE_UNKNOWN` are never retried in-process, unchanged. Both `fetchProducts()` and `fetchOrders()`'s pagination loops in `tiktok-shop.adapter.ts` route through the retrying variant. TikTok's documented rate limit (third-party-sourced, unconfirmed against a primary source) is reportedly ~50 requests/second per store per app in production, and a unified 1,000 QPH for sandbox shops.

---

## 5. OAuth / token security

Reuses PROMOTION-OPS-1's hardened pattern rather than a weaker parallel implementation:

- **Encryption**: `utils/secret-encryption.ts` was refactored from a single hardcoded `SOCIAL_TOKEN_ENCRYPTION_KEY`-bound module into a `createSecretCipher(envVarName, devLabel, currentVersion)` factory. The original top-level `encryptSecret`/`decryptSecret`/`CURRENT_KEY_VERSION` exports remain bound to a `socialTokenCipher` instance (`SOCIAL_TOKEN_ENCRYPTION_KEY`) for full backward compatibility with existing callers (`social-connection.controller.ts`, `promotion-campaign.queue.ts`). A new `channelTokenCipher` export is bound to a **separate** `CHANNEL_TOKEN_ENCRYPTION_KEY` — the two domains never share a key namespace, env var, or dev-mode fallback derivation. Same AES-256-GCM primitive, fresh IV per encryption, versioned ciphertext format (`token_encryption_key_version`), fail-closed in production if the key is unset.
- **Never-leak guarantee**: `CommerceChannelAccountDto`/`toCommerceChannelAccountDto()` is an allowlist type — `access_token_encrypted`/`refresh_token_encrypted`/`shop_cipher` are structurally absent from every API response, verified by a test.
- **CSRF/state**: `channel-oauth-state.helpers.ts` stores `PendingChannelOAuthState {channelType, userId, redirectUri}` in Redis under `commerce_channel_oauth_state:<state>`, 10-minute TTL, single-use (deleted on first read regardless of outcome). No PKCE — TikTok Shop's OAuth flow doesn't use it (unlike PROMOTION-OPS-1's X/Twitter adapter).
- **redirectUri binding**: `isAllowedChannelRedirectOrigin()` checks against `CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS`, fail-closed, before any authorize URL is built. The exact `redirectUri` is bound into the stored state and re-checked at `completeChannelOAuth()`.
- **Actor binding**: the initiating staff user's ID is bound into the stored state; completing the flow as a different user is rejected.
- **Currency confirmation**: TikTok's OAuth/shop-lookup response provides `region` (used for `marketCountry`) but no shop-level currency in any source consulted. Rather than guess a currency from country, `completeChannelOAuth` requires an explicit `marketCurrency` field (validated server-side against `/^[A-Z]{3}$/`), and the frontend callback page shows a currency-confirmation `Select` (EUR/USD/GBP, defaulting to EUR) before submitting — the literal implementation of "do not hardcode Italy... channel account should know its own market/currency."

---

## 6. Product/SKU sync — preview/commit

Modeled directly on `suppliers/supplier-import.controller.ts`'s preview/commit split (`channel-sync.service.ts`):

- **`previewProductSync(channelAccountId, triggeredBy)`** — READ + DIFF only. Fetches real products via `adapter.fetchProducts()`, diffs against existing `channel_product_mappings` and real `products.sku` (exact match only, never fuzzy), stores the full plan as `parsed_items` JSONB on a new `channel_sync_runs` row (`status = 'preview'`). Writes nothing to `channel_product_mappings` itself.
- **`commitProductSync(channelAccountId, runId, actorUserId)`** — loads the stored plan, applies it inside one transaction, upserting `channel_product_mappings` via `ON CONFLICT (channel_account_id, channel_product_id, channel_sku) DO UPDATE ... RETURNING (xmax = 0) AS inserted` (the Postgres trick for insert-vs-update detection), then marks the run `'committed'`. Re-committing an already-committed run **throws** — never a silent no-op.
- A TikTok listing with no matching TechTools SKU becomes `mapping_status = 'CHANNEL_ONLY'`, never dropped from the plan.

`channel-product-sync.worker.ts` runs `previewProductSync()` automatically (every `CHANNEL_PRODUCT_SYNC_INTERVAL_MS`, default 30 min) for every `CONNECTED`, non-disabled channel account — it **never** calls commit. Commit stays a deliberate human action via `POST /channels/products/commit-sync`, per "do not automatically overwrite TikTok listings" (which applies symmetrically: TechTools never auto-applies what it read from TikTok either, without a human reviewing the diff first).

---

## 7. Inventory diff

`runInventoryDiff(channelAccountId, triggeredBy)` — unlike product sync, there is no separate commit step: a diff report **is** the terminal output, not a plan waiting to be applied. The `channel_sync_runs` row this creates goes straight to `'committed'` inside the same transaction. Compares real `inventory.available_stock` (joined via `channel_product_mappings.product_id`, only for `mapping_status = 'MAPPED'` rows) against a fresh `adapter.fetchProducts()` call's stock figures. A mismatch is `action_taken = 'FLAGGED'`; a match is `'NONE'`. The flagged count is stored in `error_report` JSONB (`{flaggedCount: N}`) rather than the semantically-mismatched `unmapped_count` column (a product-sync concept). Never writes to `inventory.current_stock`/`reserved_stock`, and never calls a channel write endpoint — enforced as a structural regression-test assertion (`channel-sync.service.test.ts` greps every mocked query call for `UPDATE inventory` and asserts zero).

`channel-inventory-diff.worker.ts` runs this automatically on the same poller shape.

---

## 8. Order import

`importOrders(channelAccountId, triggeredBy, options?)` — idempotent reconciliation, checkpointed incrementally rather than either a fixed rolling re-download or an unbounded historical export. Fetches orders via `adapter.fetchOrders(creds, sinceDate)`.

- **Checkpoint (Production Review Round 1 §18/§24)**: `commerce_channel_accounts.order_import_watermark` persists the start time of the last **fully successful** import run. `sinceDate` is `watermark - 2h overlap buffer` when a watermark exists (the overlap absorbs clock skew and any order whose own record briefly lags its creation), falling back to a fixed `ORDER_IMPORT_LOOKBACK_MS` (7 days) only for a channel account's first-ever import. The watermark is advanced **only** when the fetch was fully complete (see pagination below) and this isn't a backfill run — a partial failure or an explicit backfill never moves it, so a page that failed to fetch is retried from the same starting point next time, never silently skipped.
- **Backfill mode (§25)**: `importOrders(id, triggeredBy, { fromDate })` bypasses the watermark/rolling-window entirely and never advances the watermark itself — a one-off, human-requested historical import (`POST /channels/orders/import` with a `fromDate` body field, or the Orders page's "Backfill" dialog) that can't interfere with the ongoing incremental checkpoint.
- **Pagination failure safety (§19/§23)**: `TikTokShopAdapter.fetchOrders()` returns `FetchOrdersResult { orders, complete, error? }`, never throwing away pages that succeeded just because a later page failed (even after retry/backoff, §4, is exhausted). `importOrders()` still creates a `channel_sync_runs` row and imports every order actually fetched, but marks the run `status = 'failed'` (not `'committed'`) and skips the watermark advance when `complete` is `false`.
- **Idempotency**: upserts `channel_orders` via `ON CONFLICT (channel_account_id, channel_order_id) DO UPDATE ...` — re-importing the same order updates it in place, **never** creates a duplicate. This is the actual mechanism behind §9's "a TikTok order/webhook must never create duplicate TechTools orders" requirement, independent of anything the webhook receiver does (which never writes an order row at all — see §9 — so there is no polling/webhook race to resolve in the first place).
- **Out-of-order/stale events (§8 of the founder's review, CRITICAL)**: the upsert's `WHERE` clause — `EXCLUDED.external_updated_at IS NULL OR channel_orders.external_updated_at IS NULL OR EXCLUDED.external_updated_at >= channel_orders.external_updated_at` — rejects an update whose remote timestamp is older than what's already stored (Postgres returns zero rows from `RETURNING` in that case). A rejected/stale event is logged to `channel_activity_log` as `ORDER_IMPORT_STALE_EVENT_IGNORED` and its line items are left untouched. `channel_orders.external_updated_at` comes from `TikTokShopOrder.update_time` if TikTok supplies it (unverified against a primary source, by analogy with the confirmed `create_time` field); its absence means every update is applied unconditionally — a documented, safe fallback, not a guess.
- Line items are replaced wholesale on every applied (re-)import (`DELETE FROM channel_order_items WHERE channel_order_id = ...` then re-insert) — simpler and safer than diffing individual lines.
- An order that cannot become a valid row at all — missing/unparseable `grossAmount`, missing `currency`, or no external order ID — is recorded in `channel_order_import_issues` instead of silently skipped (see §8a below); this is distinct from an *unmapped SKU*, which is not a failure (next bullet).
- Line items resolve `channel_product_mapping_id` via the existing `channel_product_mappings` table when a match exists; an unmapped line is still imported normally, just with a `NULL` mapping. `listChannelOrders` computes a `needs_mapping` flag per order for the ops UI.
- Deliberately never populates `channel_orders.techtools_order_id`, and never writes to `orders`/`inventory` — see §1's domain-model rationale.

`channel-order-import.worker.ts` runs this automatically (every `CHANNEL_ORDER_IMPORT_INTERVAL_MS`, default 10 min) for every `CONNECTED`, non-disabled channel account, gated by both `CHANNEL_SYNC_QUEUE_ENABLED` and its own `CHANNEL_ORDER_IMPORT_WORKER_ENABLED` (Production Review Round 1 §17/§28 — independent per-worker kill switches). This worker — not the webhook receiver — is what actually keeps `channel_orders` current; see §9 for why.

### 8a. Order-import reconciliation queue

`channel_order_import_issues` (migration `047`) — a durable record for a remote order that genuinely cannot be normalized into a `channel_orders` row, so "a real TikTok order must never disappear silently" (Production Review Round 1 §5, CRITICAL) holds even for malformed data. `classifyUnimportableOrder()` in `channel-sync.service.ts` assigns one of `INVALID_ORDER_AMOUNT` / `MISSING_CURRENCY` / `MALFORMED_REMOTE_ORDER` (the only three reason codes any code this phase emits — `MISSING_REQUIRED_SKU`/`UNMAPPED_PRODUCT`/`UNSUPPORTED_ORDER_STATE` remain in the schema's `CHECK` constraint for forward compatibility with the founder's own example list, unreachable today). A partial unique index (`ux_channel_order_import_issues_open`, scoped `WHERE resolved_at IS NULL`) means re-detecting the same broken order on a later poll updates the one open row in place rather than accumulating duplicates; a resolved issue that recurs later opens a fresh row, preserving history. Deliberately minimal PII — no buyer columns at all, only `external_order_id` and a short technical reason (§15 of the review). Surfaced on the Orders page's "Needs reconciliation" tab and the Overview page's "Needs Attention" card; `POST /channels/orders/issues/:issueId/resolve` is a human bookkeeping action (records who/why) that does **not** retroactively create the order — the underlying data problem must be fixed before the next import run succeeds for that order.

---

## 9. Webhook receiver

`channel-webhook.controller.ts`'s `handleTikTokShopWebhook` is a structural clone of `payments/payment.controller.ts`'s Stripe `handleWebhook` — the only other inbound-webhook precedent in this codebase: raw-body signature verification, then an `INSERT ... ON CONFLICT (tts_notification_id) DO NOTHING` idempotency gate, then event-type dispatch. Mounted at `POST /channels/webhook/tiktok-shop`, deliberately **not** behind `authenticate()` — the HMAC signature itself is the authentication, and TikTok calls this endpoint with no TechTools session.

**Critical, deliberate design constraint**: TikTok's webhook signature scheme (`tiktok-shop.webhook-verify.ts`) has **no timestamp and no replay protection** — the `Authorization` header is `hex(HMAC-SHA256(key=app_secret, message=app_key+raw_body))`, and a captured, valid signature can be replayed indefinitely; dedup relies entirely on `tts_notification_id` uniqueness. Given this, every event handler in the controller only ever **logs to `channel_activity_log` and flags for reconciliation** — it never auto-mutates order or inventory state directly from a webhook payload. Real state changes happen exclusively through the polling read/diff/import workers (§6–§8), which independently re-verify against TikTok's own API rather than trusting a pushed payload as sole ground truth.

The one narrow exception: `SELLER_DEAUTHORIZATION` immediately sets `commerce_channel_accounts.status = 'NEEDS_CREDENTIALS'` — justified as reacting to an authorization event about the connection itself (which this deployment has no other way to learn about until the next API call fails), not as trusting webhook data as commerce ground truth.

Real event types this phase recognizes (`KNOWN_EVENT_TYPES`, sourced from official-domain research): `ORDER_STATUS_CHANGE, RECIPIENT_ADDRESS_UPDATE, PACKAGE_UPDATE, PRODUCT_STATUS_CHANGE, SELLER_DEAUTHORIZATION, UPCOMING_AUTHORIZATION_EXPIRATION, CANCELLATION_STATUS_CHANGE, RETURN_STATUS_CHANGE, REVERSE_STATUS_UPDATE, PRODUCT_INFORMATION_CHANGE, PRODUCT_CREATION, PRODUCT_CATEGORY_CHANGE, PRODUCT_AUDIT_STATUS_CHANGE, INVOICE_STATUS_CHANGE`. An unrecognized event type is stored (for visibility) and acknowledged with 200, never a 500 — TikTok can add new topics this deployment doesn't yet know about. A downstream processing error (e.g. the activity-log insert failing) is caught, recorded into `channel_webhook_events.processing_error`, and still acknowledged 200 — a webhook TikTok already delivered and this endpoint already durably recorded should not be redelivered forever because of TechTools' own bookkeeping failure.

---

## 10. Finance/settlement, affiliate, and ads — deferred, schema-only

`channel_financial_transactions` (migration `046`) exists with `transaction_type CHECK IN ('SETTLEMENT', 'COMMISSION', 'AD_SPEND', 'REFUND', 'AFFILIATE_COMMISSION')`, but **no code this phase ever populates it**. Order import deliberately leaves `channel_orders.platform_commission_amount` and `.net_amount` `NULL` — order-search-style APIs generally don't report actual fee/commission figures (that's Finance-API territory), and estimating them from discount fields (`platform_discount`, `seller_discount`) would misrepresent a price discount as a platform fee, two genuinely different concepts. `shipping_fee_amount`/`tax_amount` are populated directly from the order API's own reported figures where present. Populating `channel_financial_transactions` for real is explicitly the next build step, gated on genuinely-verified Finance/Affiliate API access — no environment in this deployment currently has real TikTok developer credentials to verify against.

---

## 11. Worker convention

Every worker in `services/channels/` follows the exact `setInterval` poller shape used throughout this codebase (`promotion-campaign.queue.ts`, `newsletter.queue.ts`) — no Bull/BullMQ introduced:

- Module-level `workerStarted`/`workerTimer`/`workerBusy` flags (re-entrancy guard).
- `start*Worker()`/`stop*Worker()` exports, wired into `src/index.ts`'s startup sequence and both `SIGTERM`/`SIGINT` graceful-shutdown handlers.
- A `__process*TickForTests` test-only export, so tests can invoke exactly one tick deterministically instead of racing a real timer.
- Gated by `CHANNEL_SYNC_QUEUE_ENABLED !== 'false'` — the same single-instance safety valve PROMOTION-OPS-1 established (`PROMOTION_QUEUE_ENABLED`) after confirming, via `infrastructure/docker-compose.prod.yml`'s fixed `container_name: techtools-api-prod`, that production runs exactly one API process today. If production is ever scaled to multiple replicas, all but one instance's `CHANNEL_SYNC_QUEUE_ENABLED` must be set to `false` until a `FOR UPDATE SKIP LOCKED` claim model is added.
- **Production Review Round 1**: each worker also checks its own independent flag on top of the blanket one — `CHANNEL_PRODUCT_SYNC_WORKER_ENABLED`, `CHANNEL_ORDER_IMPORT_WORKER_ENABLED`, `CHANNEL_INVENTORY_DIFF_WORKER_ENABLED` — so one worker can be paused for investigation without stopping the other two.
- A failure processing one channel account never stops the others in the same tick; a failure in the initial account-listing query never crashes the tick.

---

## 12. Frontend layout

`admin-dashboard/app/(dashboard)/dashboard/channels/tiktok/`:

```
page.tsx                        — Overview: connection status, real cross-section counts
                                   (product mappings / orders / flagged inventory mismatches),
                                   a Needs Attention card, honest "not built yet" Finance notice
products/page.tsx               — Product mapping preview/commit two-step UI + inventory diff card
orders/page.tsx                 — Read-only imported-order list + manual "Import now" trigger
connection/page.tsx             — Connect/disconnect/disable (clone of Promotions Connections page)
connection/callback/page.tsx    — OAuth callback, with the marketCurrency confirmation Select (§5)
```

`components/layout/Sidebar.tsx`'s "Channels" nav group (base `channels.tiktok.view` gate, `Store` icon) lists exactly these pages, tighter-gated per child (`Product Mappings`/`Orders` behind their own permission, `Connection` behind `channels.tiktok.connections`) — never a link to a route that doesn't exist yet, the exact discipline established after the pre-PROMOTION-OPS-1 `/dashboard/promotions` 404 incident. "Sync History" is not yet listed, since no dedicated sync-run-history page exists this phase (`channel_sync_runs` rows are visible indirectly via the product-mappings/inventory-diff pages, not yet a standalone audit view).

---

## 13. Known gaps / next-phase items

*(Updated after Production Review Round 1 — items resolved that round are marked accordingly; the remaining list is what's still genuinely open.)*

- No `FOR UPDATE SKIP LOCKED` in the sync workers — mitigated today by `CHANNEL_SYNC_QUEUE_ENABLED` (now joined by three independent per-worker flags, §11) and the confirmed single-instance production topology, same as PROMOTION-OPS-1's identical, still-open gap.
- No per-provider remote-state reconciliation call for an order/product that TikTok's own webhook flagged as changed but that hasn't yet appeared in the next poll — the poller's checkpoint-based incremental window (§8, Production Review Round 1) is the mitigation, not a push-driven fast path.
- Finance/affiliate/ads sync: schema-only, populated in a later step once real API access is verified (§10) — explicitly out of scope for Production Review Round 1 too, per instruction.
- No dedicated Sync History page — `channel_sync_runs` audit rows exist and are queryable (and now reliably created even on a partial pagination failure, §8), but no standalone UI lists them yet.
- No dedicated "Last synced N minutes ago" staleness widget — per-row `last_synced_at` timestamps exist and are shown, but a threshold-based staleness alert was judged premature without a Sync History surface to anchor it (Production Review Round 1 §27).
- No TikTok-specific rules wired into the shared alerts framework — the Overview page's "Needs Attention" card (now including the order-reconciliation-issue count, §8a) remains the interim coverage (Production Review Round 1 §28, explicit "don't build a second alerts framework" instruction).
- `channels.tiktok.fulfillment` permission exists in the matrix but is unused — no fulfilment-write code exists this phase (per §35's "do not blindly overwrite inventory/fulfilment" boundary).
- OAuth flow, signing, and webhook-verification algorithms are unverified against a primary TikTok source (Partner Center's docs are unreadable to automated tools) — flagged throughout `tiktok-shop/` and must be re-checked against real Partner Center documentation and a real sandbox app before this adapter is ever pointed at a live shop. Re-confirmed unchanged in Production Review Round 1's own fresh research pass.
- No Amazon/eBay adapter exists — the `ChannelAdapter` interface and generic table naming are shaped for it, but no second implementation was written, per explicit scope boundary.
- No Seller Center deep links (view order/listing directly in TikTok) — URL structures could not be confirmed against a primary source; inventing one was explicitly avoided (Production Review Round 1 §24).

**Resolved in Production Review Round 1** (kept here for continuity with anyone who read the pre-review version of this doc): silent order loss on unparseable data (§8a's reconciliation queue), out-of-order/stale webhook-triggered re-imports regressing a known-newer status (§8), unbounded re-fetching of the same rolling window forever (§8's watermark checkpoint), a mid-pagination failure discarding already-fetched orders and leaving no audit trail (§8), the `channel_orders` market-scope IDOR gap (§2), and the original build's `'UNKNOWN'` currency sentinel (§8, now routed to the reconciliation queue instead).
