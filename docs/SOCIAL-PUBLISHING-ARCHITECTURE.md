# Social Publishing Architecture (PROMOTION-OPS-1)

Technical reference for the omnichannel promotion/publishing system. Paired with `docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md`, which covers the phase narrative, audit findings, and test/gate results — this document is the durable "how it works" reference for whoever next touches this code.

**Updated for Production Review Round 1** (see the implementation report's "Production Review Round 1" section for the full narrative): dry-run channel posts now resolve to `DRY_RUN_SUCCEEDED`/campaigns to `DRY_RUN_COMPLETED`, never `PUBLISHED` (§4); failures are classified `SAFE_TO_RETRY`/`DO_NOT_RETRY`/`REMOTE_STATE_UNKNOWN` at the adapter layer (§4); a stuck-`PUBLISHING` sweep and a `REQUIRES_ACTION` human-resolution flow replace the prior unsolved idempotency gap (§4); `market_scope` is now enforced server-side (§1); OAuth state moved from an in-memory `Map` to Redis with redirectUri and actor binding (§5); a connection's status now honestly downgrades on `AUTH_EXPIRED`/`MISSING_SCOPE` (§8).

---

## 1. Domain model

Two migrations, split by dependency direction so each is independently applicable and testable:

- **`042_social_connections.sql`** — the connections/publishing-ledger domain, zero dependency on campaigns: `social_platform` enum, `social_connection_status` enum, `social_connections`, `social_publish_attempts`, `social_metric_snapshots`.
- **`043_promotion_campaigns.sql`** — the campaign/content domain, with a clean forward FK to `social_connections`: `promotion_campaign_status` enum, `promotion_channel_post_status` enum, `promotion_campaigns`, `promotion_campaign_products`, `promotion_channel_posts`, `promotion_activity_log`. Ends with two `ALTER TABLE ... ADD CONSTRAINT` statements giving `social_publish_attempts.channel_post_id` and `social_metric_snapshots.channel_post_id` their FK to `promotion_channel_posts` — the one deliberate forward-reference patch, since 042 predates the table it eventually points to.

```
promotion_campaigns 1──* promotion_channel_posts *──1 social_connections
        │                        │  │
        │ 1──*                   │  └──* social_publish_attempts (append-only ledger)
        ▼                        │
promotion_campaign_products      └──* social_metric_snapshots (periodic snapshots)
        │
        └──? products (ON DELETE SET NULL, snapshot columns survive)

promotion_campaigns *──1 coupons (existing table, reused as-is)
promotion_activity_log *──1 promotion_campaigns, *──? promotion_channel_posts, *──? users
```

**Why a join table (`promotion_campaign_products`), not a JSONB array on the campaign row:** the instruction was "snapshot only what's necessary for historical rendering, don't duplicate product data unnecessarily." A JSONB blob would either duplicate the entire product row (violating the "don't duplicate" half) or store an unindexable, unjoinable subset (defeating a real anticipated query — "which campaigns feature product X" — for a future product-detail badge or reporting view). A join table with a nullable `product_id` FK (`ON DELETE SET NULL`, so a later product deletion never deletes campaign history) plus four snapshot columns (`snapshot_name`, `snapshot_slug`, `snapshot_price`, `snapshot_image_url`) satisfies both halves at once.

**Why `promotion_channel_posts` is the unit of independent publishing, not a JSONB array on the campaign:** every founder requirement about partial success ("Facebook succeeded, LinkedIn failed, the successful posts must not be rolled back") requires a row with its own lifecycle, retry counters, and remote IDs — a real table with `UNIQUE(campaign_id, channel)`, not a nested structure a single UPDATE could accidentally overwrite in bulk.

`promotion_campaigns.market_scope TEXT[]` is enforced server-side as of Production Review Round 1 (see `docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md` §R1.8/R1.9) via `tech-tools-api/src/api/v1/promotions/promotion-scope.helpers.ts`, reusing `resolveStaffScope()` from Analytics 2.0 rather than a new scoping mechanism: list queries filter by array overlap (`market_scope && caller_scope`, fail-closed to `1=0` if the caller's own scope is empty), and every by-ID route loads the campaign through a shared `loadCampaignWithScopeCheck()` helper that 404s (never 403s) for an out-of-scope campaign, matching this codebase's existing IDOR convention.

`promotion_channel_posts.last_error_code TEXT` (added in Production Review Round 1) carries the machine-readable failure reason (e.g. `AUTH_EXPIRED`, `RATE_LIMITED`, `REMOTE_STATE_UNKNOWN`, `STUCK_PUBLISHING_TIMEOUT`) that the queue and UI branch on; `last_error` stays the human-readable message. `promotion_channel_post_status` gained `DRY_RUN_SUCCEEDED` and `REQUIRES_ACTION` (replacing the original `SKIPPED_DRY_RUN`, before it was ever applied anywhere — see §4); `promotion_campaign_status` gained `DRY_RUN_COMPLETED`.

---

## 2. Permission model

Six new permissions in `tech-tools-api/src/config/staff-permissions.config.ts`:

| Permission | Meaning |
|---|---|
| `social.view` | See campaign performance/status |
| `social.publish` | Trigger publish-now |
| `social.schedule` | Schedule a campaign for later |
| `social.analytics` | View channel metrics |
| `social.accounts.view` | See connected accounts (never tokens) |
| `social.accounts.manage` | Connect/disconnect/disable platform accounts |

`campaigns.view`/`campaigns.manage` already existed in the matrix (added in an earlier phase) but were unused anywhere in code — adopted here as their evidently-intended purpose (campaign CRUD/composer/list/detail).

**Grant matrix:**

| Role | `campaigns.*` | `social.view/publish/schedule/analytics` | `social.accounts.*` |
|---|---|---|---|
| OWNER, SUPER_ADMIN | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ❌ |
| MARKETING_MANAGER | ✅ | ✅ | ❌ |
| MARKET_MANAGER | ❌ | ❌ | ❌ |
| CATALOG_MANAGER, ORDER_MANAGER, SUPPORT_AGENT | ❌ | ❌ | ❌ |

Two deliberate asymmetries, both explicit phase requirements:
1. **Posting ≠ connecting accounts.** Even ADMIN — which already holds broad operational access matching the legacy `admin` user type — does not get `social.accounts.*`. Account connection is grouped with this codebase's other "sensitive configuration" permissions (`settings.*`, `security.*`, `payments.manage`, `staff.manage`), all OWNER/SUPER_ADMIN-only. `social.accounts.*` can be loosened later once a real deployment proves the workflow — the same escape hatch already used for `MARKET_MANAGER`'s deliberately narrow grant in this file.
2. **`MARKET_MANAGER` gains nothing.** Holds `marketing.view` only, unchanged. A regression test (`staff-permissions.config.test.ts`) asserts the intersection of `MARKET_MANAGER`'s permission set with all 6 new permissions is empty — this is the exact invariant the phase spec was most explicit about protecting.

Route guards use the existing `requirePermissionOrLegacyRole(permission, 'admin', 'super_admin')` bootstrap pattern throughout (`tech-tools-api/src/middleware/staff.ts`) — no new middleware primitive was introduced.

---

## 3. Adapter architecture

`tech-tools-api/src/services/social-adapters/`:

```
social-adapter.types.ts   — SocialPublisherAdapter interface, PlatformCapabilities, PlatformReadiness, error types
base-social-adapter.ts    — shared readiness/capability-reporting logic (env-var driven)
facebook.adapter.ts       — one class per platform, each ~150-250 lines
instagram.adapter.ts
tiktok.adapter.ts
linkedin.adapter.ts
pinterest.adapter.ts
x.adapter.ts
registry.ts                — getAdapter(platform), getAllCapabilities() -- the ONLY place that imports concrete adapter classes
```

No controller or the queue worker ever branches on `if (platform === 'instagram')` — every caller goes through `registry.ts`.

### 3.1 Interface

```ts
interface SocialPublisherAdapter {
  platform: SocialPlatform
  getCapabilities(): PlatformCapabilities
  buildAuthorizeUrl(redirectUri: string, state: string, codeVerifier?: string): string
  exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo>
  validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }>
  validatePost(input: ValidatePostInput): ValidationResult          // pure, offline
  uploadMedia(connection, buffer, mimeType): Promise<{ mediaRef: string }>
  publish(input: PublishInput): Promise<PublishResult>              // real network call, always
  getPostStatus(connection, remotePostId): Promise<PostStatusResult>
  fetchMetrics(connection, remotePostId): Promise<MetricsResult>
  deletePost?(connection, remotePostId): Promise<void>
  refreshToken?(connection): Promise<ConnectedAccountInfo>
}
```

**`publish()` is always a real, complete implementation — it never internally checks a dry-run flag.** Dry-run gating happens exactly once, in `promotion-campaign.queue.ts`, one layer above every adapter. This keeps every adapter honestly "real code, unexercised without credentials" rather than secretly half-implemented behind a flag baked into the class itself.

### 3.2 Readiness

```ts
type PlatformReadiness = 'NOT_CONFIGURED' | 'NEEDS_CREDENTIALS' | 'AVAILABLE'
```

- `NOT_CONFIGURED` — `SOCIAL_<PLATFORM>_ENABLED` is not `'true'`. The founder has not decided to turn this connector on.
- `NEEDS_CREDENTIALS` — flag on, but `SOCIAL_<PLATFORM>_CLIENT_ID`/`_CLIENT_SECRET` missing.
- `AVAILABLE` — flag on and both credentials present. **Still does not mean the platform's own app-review process is complete** — see `requiresAppReview` per capability, and §8.

`buildAuthorizeUrl()` throws `PlatformNotConfiguredError` unless readiness is `AVAILABLE` — no adapter can ever hand back a URL for an OAuth exchange this deployment cannot complete.

**In this development environment, every one of the 6 platforms reports `NOT_CONFIGURED` (no env vars set at all)** — verified by `registry.test.ts`, which asserts this explicitly against the real (credential-less) `process.env`.

### 3.3 Real, verified OAuth endpoint shapes

Every adapter's `buildAuthorizeUrl()`/`exchangeCodeForToken()` endpoint URLs and required parameters were checked against each platform's current official developer documentation at implementation time (not reconstructed from memory) — per the phase's explicit "do not fake platform capabilities" instruction:

| Platform | Authorize URL | Token URL | PKCE |
|---|---|---|---|
| Facebook | `https://www.facebook.com/v25.0/dialog/oauth` | `https://graph.facebook.com/v25.0/oauth/access_token` | not documented for this flow |
| Instagram | `https://www.instagram.com/oauth/authorize` | `https://api.instagram.com/oauth/access_token` (then exchanged for a long-lived token via `https://graph.instagram.com/access_token`) | no |
| TikTok | `https://www.tiktok.com/v2/auth/authorize/` | `https://open.tiktokapis.com/v2/oauth/token/` | supplied (required for mobile/desktop; harmless to always include) |
| LinkedIn | `https://www.linkedin.com/oauth/v2/authorization` | `https://www.linkedin.com/oauth/v2/accessToken` | no |
| Pinterest | `https://www.pinterest.com/oauth/` | `https://api.pinterest.com/v5/oauth/token` (HTTP Basic auth with client_id:client_secret) | not documented |
| X | `https://x.com/i/oauth2/authorize` | `https://api.x.com/2/oauth2/token` | **required** — `x.adapter.ts` throws if no `code_verifier` is supplied |

Graph API version numbers (`v25.0`) and LinkedIn's versioned `LinkedIn-Version` header (`202601`) are pinned as of implementation time — **re-verify against each platform's currently-supported version list before enabling a connector in production**, since platforms retire old API versions on their own schedule.

### 3.4 Capability matrix (as implemented)

| | Facebook | Instagram | TikTok | LinkedIn | Pinterest | X |
|---|---|---|---|---|---|---|
| App review required | Yes | Yes | Yes (+ separate Direct Post grant) | Yes | Yes (Standard Access) | No |
| Text-only post | Yes | No | No | Yes | No | Yes |
| Image | Yes | Yes | Yes | Yes | Yes (exactly 1) | Yes |
| Multi-image | Yes | Yes (carousel) | Yes | Yes | No | Yes (up to 4) |
| Video | Yes | Yes | Yes | Yes | Yes | Yes |
| Reel/Short | Yes | Yes | Yes | No | No | No |
| Link in post | Yes | No (plain text only) | No | Yes | Yes (Pin destination) | Yes |
| Native scheduling | Yes | No | No | No | No | No |
| Post metrics | Yes | Yes | No (not in this scope) | Yes | Yes | Yes |
| Comments API | Yes | Yes | No | No | No | No |
| Delete | Yes | No | No | Yes | Yes | Yes |
| Edit | Yes | No | No | No | Yes | No |
| Rate limit | App-hour scaling formula | Same (Graph) | Assigned per app | Assigned per app | 1,000/day (Trial) | Severely tier-dependent |
| Token expiry | ~60d (long-lived Page token) | ~60d (exchanged) | ~24h access / ~365d refresh | ~60d | ~30d (extendable ~1y) | ~2h / refresh available |

"Native scheduling: No" for every platform except Facebook means this app's own queue-based scheduler (§4) is what makes scheduling possible for those channels — not a platform limitation on TechTools' own scheduling feature, which works uniformly across all 6.

---

## 4. Scheduling / queue architecture

`tech-tools-api/src/services/promotion-campaign.queue.ts` — same shape as the pre-existing `newsletter.queue.ts` (this codebase's one consistent async-worker convention: a plain `setInterval` poller with a re-entrancy guard, registered via `startX()`/`stopX()` in `src/index.ts`'s startup and graceful-shutdown blocks). **No job-queue library was introduced** — confirmed during this phase's own audit that none exists anywhere in this codebase, and Redis here is pure key-value (refresh tokens only), not a queue backend.

### Tick sequence (as of Production Review Round 1)

0. **`isQueueEnabled()`** — `startPromotionQueueWorker()` checks `PROMOTION_QUEUE_ENABLED` (default `true`) before ever starting the interval; if `false`, it logs and returns immediately. Production topology (`infrastructure/docker-compose.prod.yml`'s fixed `container_name: techtools-api-prod`, which is incompatible with Compose's `--scale`) is concrete evidence exactly one API process runs today, so the default is safe as-is — this flag exists as the explicit off-switch for any future replica that must not double-publish.
1. **`promoteScheduledChannelPosts()`** — bulk `UPDATE` moves `DRAFT` channel posts whose (own or campaign-inherited) `scheduled_at` has arrived into `QUEUED`, and flips the parent campaign from `SCHEDULED` to `PUBLISHING` the first time this happens for it.
2. **`sweepStuckPublishingRows()`** — any channel post left in `PUBLISHING` with `remote_post_id IS NULL` and `publishing_started_at` older than `PROMOTION_STUCK_TIMEOUT_SECONDS` (default 300) is moved to `REQUIRES_ACTION` (never blindly back to `QUEUED` — see "Idempotency, precisely" below) and logged.
3. **`claimBatch()`** — `UPDATE promotion_channel_posts SET status='PUBLISHING', publishing_started_at=now() WHERE id IN (SELECT ... WHERE status='QUEUED' ... LIMIT N) RETURNING *`. **This claim happens before any network call** — the foundation of the idempotency guarantee below.
4. Each claimed row is processed **sequentially** (not `Promise.all`) — bounded outbound concurrency, matching `newsletter.queue.ts`'s controlled-rate style:
   - **Idempotency check**: if `remote_post_id` is already set (a prior attempt crashed after the real platform call succeeded but before this process recorded it), record a `SKIPPED_ALREADY_PUBLISHED` attempt and mark `PUBLISHED` (or `DRY_RUN_SUCCEEDED` if `dry_run`) — **never calls `adapter.publish()` again**.
   - **Dry-run**: if `dry_run` is true, synthesize `remote_post_id = 'dry-run-<uuid>'`, record a `SUCCESS` attempt with `dry_run: true`, mark `DRY_RUN_SUCCEEDED` — **structurally distinct from `PUBLISHED`**, so a simulated publish can never be read as a genuine one (Production Review Round 1 §R1.3; this was the one CRITICAL fix in that round). No adapter method is ever called.
   - **Missing connection**: if no `connection_id`, immediately terminal `FAILED` (`MISSING_CONNECTION`) — never attempts a call with no credentials.
   - **Real publish**: calls `getAdapter(channel).publish()`, which routes its network call through `fetchOrThrow()` (see §3.5 below) so any failure arrives pre-classified. Success → `remote_post_id`/`remote_permalink` set, `PUBLISHED`. `REMOTE_STATE_UNKNOWN` → `REQUIRES_ACTION`, never retried (a retry could create a real duplicate if the first attempt actually reached the provider). `DO_NOT_RETRY` → immediate terminal `FAILED`, and if the reason is `AUTH_EXPIRED`/`MISSING_SCOPE`, the underlying `social_connections.status` is downgraded to `TOKEN_EXPIRED`/`MISSING_PERMISSION` too (§8). `SAFE_TO_RETRY` → requeued with linear backoff (`next_attempt_at = now() + RETRY_BACKOFF_SECONDS * attempt_count`) if under `max_retries` (default 3), else terminal `FAILED`.
5. **`reconcileCampaignStatuses()`** (exported, for the manual-resolution flow to call too — see below) — recomputes each touched campaign's aggregate status from its channel posts' actual current statuses: all channels `DRY_RUN_SUCCEEDED` → campaign `DRY_RUN_COMPLETED`; all real channels succeeded → `PUBLISHED`; any mix of outcomes, or any channel `REQUIRES_ACTION` → `PARTIAL_SUCCESS`; all terminally failed with none requiring action → `FAILED`; anything still in-flight → left alone (still `PUBLISHING`). **Never rolls back an already-published channel.**
6. **`syncMetrics()`** — gated to run at most once per `PROMOTION_METRICS_SYNC_INTERVAL_MS` (default 30 min, in-memory cursor — same tradeoff `metrics.broadcaster.ts` already accepts), fetches metrics for published, **non-dry-run** posts lacking a recent snapshot (`WHERE status = 'PUBLISHED' AND dry_run = false` — a dry-run post's synthetic id can never reach a real adapter's `fetchMetrics()`), inserts one row per post into `social_metric_snapshots`.

### Retry classification (§R1.5)

`base-social-adapter.ts`'s `fetchOrThrow()` — which every adapter's `publish()` now routes its real network call through — classifies every failure into exactly one of three buckets at the moment it occurs, never post-hoc from a generic error message:

```ts
type PublishFailureClassification = 'SAFE_TO_RETRY' | 'DO_NOT_RETRY' | 'REMOTE_STATE_UNKNOWN'
```

- `fetch()` itself throwing (DNS/timeout/connection-reset — no HTTP response was ever received) is **always** `REMOTE_STATE_UNKNOWN` (`TRANSPORT_ERROR`) — whether the provider processed the request before the connection failed cannot be known.
- A definitive HTTP response is classified by `classifyHttpFailure(status)`: `401`→`DO_NOT_RETRY`/`AUTH_EXPIRED`, `403`→`DO_NOT_RETRY`/`MISSING_SCOPE`, `429`→`SAFE_TO_RETRY`/`RATE_LIMITED`, `400`/`422`→`DO_NOT_RETRY`/`INVALID_MEDIA_OR_CAPTION`, `5xx`→`SAFE_TO_RETRY`/`TEMPORARY_PROVIDER_ERROR`, anything else→`REMOTE_STATE_UNKNOWN`/`UNKNOWN_PROVIDER_ERROR` (an unrecognized definitive response is never guessed to be safe).

Only `SAFE_TO_RETRY` is ever automatically retried by the queue.

### Idempotency, precisely

The property being protected: **a worker retry, restart, or overlapping tick must never cause a real duplicate post on a real platform.** Four mechanisms together provide this:

1. **Claim-before-call**: a row can only be picked up once per claim cycle (`QUEUED` → `PUBLISHING` via the atomic `UPDATE...RETURNING`); a second concurrent tick's claim query simply won't see it.
2. **`remote_post_id`-presence check**: if a process crashes *after* a real platform call succeeds but *before* it records the result, the row is left in `PUBLISHING` with no `remote_post_id`.
3. **`sweepStuckPublishingRows()`** (§ above, added in Production Review Round 1 — this closes what was previously a documented, unsolved gap): a row stuck in `PUBLISHING` past `PROMOTION_STUCK_TIMEOUT_SECONDS` is moved to `REQUIRES_ACTION`, **not** blindly back to `QUEUED` — the outcome is genuinely unknown (the exact ambiguity `REMOTE_STATE_UNKNOWN` protects against elsewhere), so it requires the same explicit human decision via `POST /promotions/campaigns/:id/channels/:channelPostId/resolve` (which requires a real, verified `remotePostId` to mark it `PUBLISHED` — an operator must have actually checked the platform, not just clicked a button).
4. **`social_publish_attempts`** is an append-only ledger of every attempt (`dry_run`, `response_status`, `remote_post_id`, timestamps) — the audit trail that makes any investigation of a suspected duplicate possible.

**Known limitation, carried forward unchanged from every existing worker in this codebase** (`newsletter.queue.ts`, `supplier.guardrails.ts`, `workers/anomaly.detection.ts`, `workers/metrics.broadcaster.ts`): no `FOR UPDATE SKIP LOCKED`. Safety rests on the single-process assumption (one Node process running this worker) plus the in-process `busy` boolean preventing overlapping ticks — not row-level database locking. `PROMOTION_QUEUE_ENABLED` (§ above) is the explicit safety valve if this assumption is ever violated before `FOR UPDATE SKIP LOCKED` is added. This is not a new risk introduced by this feature; it is this codebase's one existing worker pattern, applied consistently. Horizontal scaling to multiple API processes would need row-level locking addressed first (see §9).

**What is still not solved, honestly**: none of the 6 adapters implement a "look up whether a post with this idempotency key already exists on the provider" reconciliation call — `getPostStatus()` exists on the interface but isn't wired into the `REQUIRES_ACTION` resolution flow yet. Today, resolving a `REQUIRES_ACTION` channel means a human checks the platform directly (via `remotePermalink` or the platform's own UI) and reports the outcome back through the resolve endpoint.

---

## 5. OAuth flow (end-to-end)

```
Admin browser                    admin-dashboard (Next.js)          tech-tools-api
     │                                    │                              │
     │  Click "Connect account"           │                              │
     │───────────────────────────────────▶│                              │
     │                                    │  POST /connections/:platform/oauth/start
     │                                    │  { redirectUri }             │
     │                                    │─────────────────────────────▶│
     │                                    │                              │ buildAuthorizeUrl()
     │                                    │                              │ (throws 409 if not AVAILABLE)
     │                                    │◀─────────────────────────────│
     │                                    │  { authorizeUrl, state }     │
     │  redirect to authorizeUrl          │                              │
     │◀───────────────────────────────────│                              │
     │                                                                   │
     │  ── user authenticates + approves on the PROVIDER's own domain ── │
     │                                                                   │
     │  redirect to redirectUri?code=...&state=...                      │
     │  (admin-dashboard's /connections/callback page)                  │
     │                                    │  POST /connections/oauth/callback
     │                                    │  { code, state, redirectUri }│
     │                                    │─────────────────────────────▶│
     │                                    │                              │ exchangeCodeForToken()
     │                                    │                              │ (client_secret used here,
     │                                    │                              │  server-side only)
     │                                    │                              │ encryptSecret() before storing
     │                                    │◀─────────────────────────────│
     │                                    │  { connection: {...} }       │
     │                                    │  (no tokens in this response)│
```

**State/CSRF (updated in Production Review Round 1)**: a random 24-byte hex `state` and a 32-byte base64url PKCE `code_verifier` are generated per OAuth start and stored in **Redis** (`tech-tools-api/src/api/v1/promotions/promotion-oauth-state.helpers.ts`, using this codebase's existing `config/redis.ts` — the same infrastructure `middleware/auth.ts` already uses for refresh tokens, not a new dependency), keyed `promotion_oauth_state:<state>`, `EX` TTL of 10 minutes. This replaced the original in-memory `Map`, which was single-process-only and lost on restart — a real risk once weighed against this deployment's actual multi-container-capable production topology (§4's `PROMOTION_QUEUE_ENABLED` note applies the same reasoning). `consumeOAuthState()` deletes the Redis key on the first read regardless of outcome (one-time use, including against replay) and returns `null` on any miss/expiry, which `completeOAuth()` turns into a 400.

**redirectUri binding (added in Production Review Round 1; origin-vs-path split clarified in the final pre-commit corrections)**: two deliberately different-granularity checks, not one. `startOAuth()` first calls `isAllowedRedirectOrigin(redirectUri)`, which compares `new URL(redirectUri).origin` — scheme + host + port **only, never a path** — against the founder-configured `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS` allowlist (comma-separated origins, fail-closed: unset means every redirectUri is rejected). This decides which *origins* may start a flow at all — e.g. `SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://techtoolstore.com`, a bare origin with no `/admin` path, since the admin dashboard's callback page lives under that origin's `/admin` prefix but the origin comparison never looks at the path. Separately, the *exact full* `redirectUri` (path included) is bound into the stored OAuth state at `startOAuth()`, and `completeOAuth()` requires the callback's `redirectUri` to match that exact stored value — this is the check that actually pins the flow to one specific callback URL, closing an open-redirect/callback-substitution path a naive "trust whatever the frontend sends" design would have left open.

**Actor binding (added in Production Review Round 1)**: the initiating staff user's ID (`req.user.userId`) is bound into the stored state at `startOAuth()`; `completeOAuth()` 403s if the authenticated caller completing the flow doesn't match, so a connection attempt started by one admin can never be completed by another.

All three are verified by `social-connection.controller.test.ts` (14 tests) using an in-memory fake matching the real Redis client's `get`/`set`/`del` surface.

**Why the redirect target is a frontend page, not a backend route directly**: the phase instruction is "OAuth callback must execute server-side" — interpreted here as *the token exchange itself* (the step that uses `client_secret` and produces a real access token) must never happen in the browser. It doesn't. The frontend's `/connections/callback` page is a thin pass-through: it reads `code`/`state` off the URL (which the provider itself put there) and immediately POSTs them to the backend, which performs the actual exchange. The frontend never sees, stores, or forwards a token — `completeOAuth()`'s response is a `SocialConnectionDto` (§6) with no token fields at all.

---

## 6. Token security

**Encryption**: `tech-tools-api/src/utils/secret-encryption.ts`, AES-256-GCM (authenticated encryption — tamper detection via the auth tag, not just confidentiality), written from scratch. An audit at the start of this phase found **zero real encryption anywhere in this codebase**: `email_sender_aliases.smtp_pass_encrypted` is stored and read as plain text despite its name (a literal `// TODO: Decrypt` sits next to every read of it), and `whatsapp_settings.is_encrypted` only ever masks a value in API responses, never encrypts storage. This file exists specifically so that mistake is not repeated for OAuth tokens — a materially higher-value secret than either of those.

- Key resolution mirrors `config/jwt.config.ts`'s `resolveSecret()` pattern: fail closed in production if `SOCIAL_TOKEN_ENCRYPTION_KEY` is unset; warn + an insecure, clearly-labeled dev-only fallback key otherwise. A *present* key that doesn't decode to exactly 32 bytes throws regardless of environment (a hard crypto-config bug, not a "weak but present secret" risk).
- Stored format: `"v<version>:<iv_b64>:<authTag_b64>:<ciphertext_b64>"` — a single opaque string, versioned so `social_connections.token_encryption_key_version` and the string's own prefix always agree.
- **Key rotation (documented, not implemented this phase)**: add a `SOCIAL_TOKEN_ENCRYPTION_KEY_V2` env var, extend `secret-encryption.ts`'s `KEYS_BY_VERSION` map with version 2, bump `CURRENT_KEY_VERSION`, then run a one-off script that reads every `social_connections` row, decrypts under its recorded `token_encryption_key_version`, re-encrypts under the new current version, and updates both the ciphertext and the version column. Only retire the old env var once every row reports the new version.

**Never-leak guarantees, enforced structurally, not by convention alone:**
- `SocialConnectionDto` (`promotion.types.ts`) is an **allowlist**, not a blacklist of a raw DB row — `toSocialConnectionDto()` names every field it copies out; `access_token_encrypted`/`refresh_token_encrypted`/`token_encryption_key_version` are structurally absent from the return type, not merely omitted by discipline. Verified by a test that constructs a row *with* real-looking ciphertext values present and asserts the serialized JSON response contains neither the field names nor the ciphertext substring.
- `promotion_activity_log.metadata` and `social_connections.metadata` both carry an explicit code comment: non-secret operational data only, never tokens.
- Disconnecting a connection (`disconnectConnection`) sets both encrypted columns to `NULL`, not just flipping `status` — verified by test.
- Adapters receive a `ConnectionCreds` object (`{connectionId, accessToken, externalAccountId}`) with an **already-decrypted** token — adapters never see ciphertext or call `decryptSecret()` themselves; only `promotion-campaign.queue.ts`'s `resolveConnectionCreds()` and the OAuth controller ever touch the encryption utility directly.

---

## 7. UTM / attribution strategy

`tech-tools-api/src/api/v1/promotions/promotion.utm.ts` — a single pure function, `buildUtmUrl()`:

```
utm_source=<platform lowercase>&utm_medium=social&utm_campaign=<campaign_key>&utm_content=<channel_post_id>
```

Appended to `promotion_campaigns.landing_url` (or the campaign's chosen product/deal URL) via `URLSearchParams`, preserving any pre-existing query parameters. `utm_medium` is always the literal string `'social'` — this builder is only ever used for the 6 social channels.

**No new analytics table, no second attribution engine.** This reuses the Analytics 2.0 Acquisition endpoint (`GET /analytics/acquisition`, `analytics-v2.controller.ts`, built in ADMIN-2B) exactly as it already exists — `user_sessions.utm_source`/`utm_medium`/`utm_campaign`/`utm_content` columns already exist (added in `026_unified_analytics_schema.sql`) and are already captured at session start; this phase produces URLs those columns already know how to read, nothing more. A campaign's commerce performance is queried by filtering Acquisition on `utm_campaign = <campaign_key>` — the campaign detail page's Performance tab does not re-implement this; it links out to social platform metrics only and leaves commerce attribution to Analytics, per the explicit "do not duplicate" instruction.

---

## 8. Provider readiness in this environment

**Two-layer readiness truth (Production Review Round 1 §R1.18)**: `PlatformReadiness` (below) is deliberately environment-level only — "can this deployment attempt an OAuth connection at all" — and never implies publish authority even at `AVAILABLE`, which is why `requiresAppReview` is a separate, always-surfaced field on every capability. The connection-level truth is carried by `social_connections.status` (`CONNECTED, TOKEN_EXPIRED, NEEDS_CREDENTIALS, MISSING_PERMISSION, APP_REVIEW_REQUIRED, DISABLED_BY_ADMIN, ERROR`), which — as of this review round — is no longer a set of unreachable enum values: the queue now downgrades a `CONNECTED` connection to `TOKEN_EXPIRED` on an `AUTH_EXPIRED` publish failure, or `MISSING_PERMISSION` on `MISSING_SCOPE`, so a connection that stops working stops silently claiming `CONNECTED` forever. This was judged sufficient to satisfy the review's request for a more granular truth model without a large-churn 5-state redesign of `PlatformReadiness` itself.



None of the 6 platforms has real developer-app credentials configured in this development sandbox — confirmed no `SOCIAL_*_CLIENT_ID`/`_CLIENT_SECRET` env vars exist, and there is no publicly reachable callback URL this sandbox could register with any provider. **Every connector therefore reports `NOT_CONFIGURED` here** (the `SOCIAL_<PLATFORM>_ENABLED` flags are also unset by default). This is by design, not a gap: the adapter code, OAuth flow, encryption, and queue pipeline are complete and real; only the founder's own step of registering a developer app per platform and setting the resulting env vars can move any one of them to `AVAILABLE`.

Bringing a connector to genuinely production-enabled additionally requires, per platform:

- **Facebook / Instagram**: a Meta Developer App with the Facebook Login and (for Instagram) Instagram Platform products added, `pages_manage_posts`/`pages_read_engagement`/`instagram_business_content_publish` etc. requested, and **Meta App Review completed** for those permissions (Development-Mode apps can only post as/to accounts explicitly added as testers).
- **TikTok**: a TikTok Developer App with Login Kit configured, **and a separate "Direct Post" audited-access grant** from TikTok on top of standard review — without it, `publish()` will fail with a permission error from TikTok's own API, not silently succeed.
- **LinkedIn**: an app with the **Community Management API product granted** via LinkedIn's Partner Program (a manual approval, separate from basic app registration).
- **Pinterest**: **Standard Access trust tier** approval (the default Trial tier is rate-limited to 1,000 calls/day and may not permit production Pin creation).
- **X**: a developer account on an **API tier with sufficient posting quota** — the free tier has historically allowed as few as tens of posts per month per app, which is the practical blocker here more than any review workflow.

---

## 9. Known gaps / deliberate non-implementations

Resolved in Production Review Round 1 (kept here crossed off, not deleted, so the history is legible): ~~no stuck-row sweep~~ (§4, `sweepStuckPublishingRows()`); ~~market-scope enforcement~~ (§1/§R1.8-9, enforced server-side); ~~OAuth state in an unsafe in-memory Map~~ (§5, moved to Redis with redirectUri/actor binding).

Still open:

- **No `FOR UPDATE SKIP LOCKED`** in the queue worker (§4) — matches every existing worker's single-process assumption. `PROMOTION_QUEUE_ENABLED` (§4) is the explicit safety valve if production is ever scaled to multiple replicas before this is addressed; not a new risk, but a real one for future horizontal scaling.
- **No per-provider remote-state reconciliation call** — `getPostStatus()` exists on the adapter interface but isn't wired into the `REQUIRES_ACTION` human-resolution flow; resolving an ambiguous outcome today means a human checks the platform directly. See "Idempotency, precisely" in §4.
- **Real end-to-end OAuth exchange** against any of the 6 platforms is unexercisable in this environment (§8) — code is complete, untested against a live provider.
- **Webhook receivers** for platforms that could push status/metric updates are not built — would need signature verification, replay protection, and idempotent processing, none of which can be meaningfully tested without live credentials.
- **Video/Reels creative** — confirmed no ffmpeg or any video-processing library exists anywhere in this codebase (`utils/media.ts`'s `processVideo()` is itself a placeholder with a literal `// TODO: Implement FFmpeg thumbnail extraction`). Creative upload is **image-only**, reusing the existing Sharp pipeline via a narrowly-scoped `promotion-creative.controller.ts` (its own dedicated multer instance, image-MIME-only, 10MB cap — not the shared 100MB/video-capable `upload` instance) that produces one optimized WebP derivative per upload (capped at 1600px) — deliberately not four platform-specific crop presets, and deliberately not added to `utils/media.ts`'s shared `IMAGE_SIZES` map, since that constant drives every existing product/category/blog image upload.
- **Product/coupon market-sellability** — a campaign's `market_scope` controls who may manage/promote it, not whether every selected product is actually sellable in that market (the catalog is global today); surfaced directly in the composer UI, not just in this doc.
- **Key rotation** — plan documented (§6), script not written.
- **Metrics-sync cursor** — in-memory, resets on worker restart (same tradeoff `metrics.broadcaster.ts` already accepts).
- **A "Promotion Pulse" summary strip** on the campaign list page (active/scheduled/publishing/failed counts) was not built — the list page is a real, working, filterable table instead; a dedicated stats endpoint would be a small, clean follow-up.
- **`email_sender_aliases.smtp_pass_encrypted` (plaintext) and WhatsApp's masking-only "encryption"** — pre-existing, unrelated to Promotions, deliberately not fixed here; see `docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md` §R1.26's security debt register.
