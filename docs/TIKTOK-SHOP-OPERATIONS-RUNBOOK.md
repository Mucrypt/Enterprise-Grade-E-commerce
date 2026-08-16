# TikTok Shop Operations Runbook

Step-by-step guide for the founder to go from "code is deployed" to "TikTok Shop is genuinely connected and syncing" — nothing here can be done from inside this codebase; every step below is either a manual action on TikTok's own developer portal or a production configuration/verification step. Paired with `docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md` (what was built, and why) and `docs/TIKTOK-SHOP-INTEGRATION-ARCHITECTURE.md` (how it works).

**Before starting**: this integration is read-only/diff-mode only. It never writes to TikTok, never spends ad money, and never auto-publishes anything. Nothing below risks TikTok Shop's live listings, and nothing below can be done accidentally — every write this system makes (a product-mapping commit, an order import) stays inside TechTools' own database.

---

## 1. Register and configure TikTok Shop developer access

1. Confirm the TikTok Shop seller account (Italy) referenced in this project is fully active in TikTok Seller Center.
2. Go to TikTok Shop Partner Center and register a developer app (a "self-built app" for a single-seller integration, not a public app for third-party sellers).
3. Note the **App Key** and **App Secret** TikTok issues — these are secrets. Never paste them into a chat log, commit message, or this repository's tracked files.
4. Request whatever scopes the app needs for product read, order read, and inventory read (Partner Center's own UI will list available scopes — grant only what's needed for read/diff, not write scopes, since this deployment has no write code to use them).
5. Submit for app review if required. Expect roughly 1–2 weeks for a clean review, longer (3+ weeks reported) for EU/Italy-specific compliance checks — this is a third-party-sourced estimate, not a guarantee; budget accordingly and don't block other work waiting on it.
6. Configure the app's OAuth redirect URI in Partner Center to match exactly `https://<your-admin-dashboard-domain>/dashboard/channels/tiktok/connection/callback` (or your actual deployed path) — TikTok will reject a callback that doesn't match exactly.

---

## 2. Verify the real next-free migration number, then apply the migrations

No live production Postgres connection exists in the environment this code was built in, so the migration numbers (`045`, `046`, `047`) were chosen from the local file sequence only, not verified against production directly. All three have been verified structurally on real, disposable PostgreSQL **15.18** and **16** clusters (production runs 15.x) — replaying the full `001`→`047` chain from empty, confirming a second run is a correct no-op, and testing the rollback path in a transaction — but that is not a substitute for checking the real production migration ledger.

```sql
SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 15;
```

If the newest row is `044` or earlier, `045`/`046`/`047` are valid as numbered — apply them normally. If a conflicting, unexpected migration already occupies any of those numbers in production, stop and renumber before applying; do not overwrite.

```bash
npm run migrate:up
```

Confirm the 10 new tables exist (`commerce_channel_accounts`, `channel_webhook_events`, `channel_activity_log`, `channel_product_mappings`, `channel_orders`, `channel_order_items`, `channel_sync_runs`, `channel_inventory_diffs`, `channel_financial_transactions`, `channel_order_import_issues`), that `channel_orders`/`commerce_channel_accounts` each gained exactly one new column (`external_updated_at`/`order_import_watermark`), and that no other pre-existing table gained/lost a column.

---

## 3. Set production environment variables

On the production server (never in a committed file):

```
CHANNEL_TIKTOK_SHOP_ENABLED=true
CHANNEL_TIKTOK_SHOP_APP_KEY=<real value from Partner Center>
CHANNEL_TIKTOK_SHOP_APP_SECRET=<real value from Partner Center>
CHANNEL_TOKEN_ENCRYPTION_KEY=<generate below>
CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://<your-admin-dashboard-domain>
```

Generate the encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This key encrypts every TikTok Shop access/refresh token at rest. It is deliberately separate from `SOCIAL_TOKEN_ENCRYPTION_KEY` (the organic-social-publishing key from PROMOTION-OPS-1) — the two must never be the same value or reused across domains.

Restart the API so it picks up the new environment variables.

---

## 4. Connect the shop

1. Log in as OWNER or SUPER_ADMIN — connecting an account requires `channels.tiktok.connections`, which no other role holds by default.
2. Go to `/dashboard/channels/tiktok/connection`.
3. Click Connect. You'll be redirected to TikTok's own OAuth consent screen.
4. Approve access from your TikTok Shop seller account.
5. On the callback page, confirm the **market currency** (defaults to EUR) — TikTok's own OAuth response does not reliably report a shop-level currency, so this is a deliberate manual confirmation step, not an automatic guess.
6. You should land back on the Connection page showing `CONNECTED`, your shop's market country/currency, and `sync_mode: READ_ONLY`.

If this fails, the error message shown is real (not generic) — common causes: redirect URI mismatch (§1.6), app review not yet complete, or a scope the app wasn't granted.

---

## 5. Verify authorization

- On `/dashboard/channels/tiktok` (Overview), confirm the Connection card shows `CONNECTED` and a real shop name/ID.
- If status ever shows `TOKEN_EXPIRED`, `NEEDS_CREDENTIALS`, or `ERROR`, reconnect from the Connection page — these are honest, real states, not placeholders.

---

## 6. Map the first product

1. Go to `/dashboard/channels/tiktok/products`.
2. Click **Preview sync**. This reads your real TikTok Shop catalog and compares it against real TechTools products by exact SKU match — nothing is written yet.
3. Review the preview summary: how many new mappings, how many updates, how many "unmapped" (a TikTok listing with no matching TechTools SKU — these are never silently dropped).
4. If the numbers look right, click **Commit**. This is the one action that writes `channel_product_mappings` — always a deliberate, separate click, never automatic.
5. For an unmapped listing, check that the TechTools product's `sku` field exactly matches TikTok's `seller_sku` — mapping is by exact match only, never fuzzy, so a typo or formatting difference (e.g. leading zeros, hyphens) will show as unmapped until corrected on one side.

---

## 7. Compare inventory

1. Still on the Product Mappings page, use the **Inventory diff** card's **Run diff** button.
2. This compares TechTools' own `available_stock` (the only inventory figure this codebase has ever actually decremented) against what TikTok currently reports for each mapped SKU — read-only, writes nothing to either side.
3. Any flagged mismatch appears in the table below. This system does not resolve mismatches automatically — investigate and correct manually (update TechTools stock, or TikTok Shop's own listing, whichever is actually wrong) until the two agree.

---

## 8. Import and verify the order flow

1. Go to `/dashboard/channels/tiktok/orders`.
2. Click **Import now** (or wait for the automatic poll, which runs every `CHANNEL_ORDER_IMPORT_INTERVAL_MS`, default 10 minutes). The first import for a freshly connected shop covers the last 7 days; every import after that continues from a persisted checkpoint, so it never re-downloads the same days forever.
3. Place a real test order on TikTok Shop if you have a way to do so safely, or wait for a genuine first sale.
4. Confirm the order appears in the list with the correct gross amount, currency, and buyer country.
5. Check the **Needs reconciliation** tab. Any order TikTok returned that couldn't be safely imported (an unparseable amount, a missing currency, or a malformed payload) appears here with a specific reason — never silently dropped. Investigate and, once the underlying data is fixed on TikTok's side (or you've reconciled it manually), click **Mark resolved** and add a short note. This does not retroactively create the order — the next import run must succeed on its own.
6. Need older orders than the current checkpoint covers? Click **Backfill**, pick a start date, and run it. A backfill is independent of the regular incremental poll — it never disturbs the ongoing checkpoint, and can be run as many times as needed.
7. Note: this phase does **not** create a corresponding row in TechTools' own `orders` table — TikTok orders are visible here for tracking/reconciliation, not yet merged into the canonical order-management flow. Don't expect a TikTok sale to show up in the regular Orders dashboard yet. Similarly, importing a TikTok order does **not** change TechTools' own inventory figures — confirm this yourself in step 7 (inventory diff) rather than assuming stock synced.

---

## 8a. Reality check against TikTok Seller Center

Before trusting this integration for daily decisions, manually compare, for the same time window:

- **Order count**: TikTok Seller Center's own order list vs. `/dashboard/channels/tiktok/orders`' count (plus anything sitting in **Needs reconciliation** — those are real orders TikTok reported that aren't fully imported yet).
- **Product/mapping count**: Seller Center's listing count vs. the Product Mappings page's count (unmapped listings show as `CHANNEL_ONLY`).
- **Inventory**: Seller Center's current stock for a few SKUs vs. the Inventory diff card's flagged mismatches.

Every discrepancy should be explainable (a very recent order not yet polled, a listing deliberately left unmapped, etc.) — an unexplained gap means something in the sync is wrong and should be investigated before relying on this data operationally.

---

## 9. Verify webhook delivery

1. In TikTok Shop Partner Center, configure the webhook URL to `https://<your-api-domain>/api/v1/channels/webhook/tiktok-shop`.
2. Trigger a real event on TikTok's side if possible (e.g. update a listing's status).
3. Confirm a row appears in `channel_webhook_events` with `signature_valid = true` and a `processed_at` timestamp.
4. If `signature_valid` is ever `false` for a delivery you believe is genuinely from TikTok, check that `CHANNEL_TIKTOK_SHOP_APP_SECRET` in production exactly matches what Partner Center shows — a mismatched secret is the most likely cause.
5. Understand the limitation: TikTok's webhook signature scheme has no timestamp or replay protection. This system never trusts a webhook payload to directly change order/inventory state — it only logs and flags, then relies on the polling workers (product sync, inventory diff, order import) to independently re-verify against TikTok's real API. This is intentional, not a bug.

---

## 10. Verify fulfilment

Not applicable yet — no fulfilment-write code exists in this phase (`channels.tiktok.fulfillment` is a reserved permission, not backed by any code path). TikTok Shop orders must currently be fulfilled directly in TikTok Seller Center until a future phase builds this.

---

## 11. Inspect profitability

Not applicable yet — `channel_financial_transactions` exists in the database schema but is not populated by any code this phase. No commission, settlement, or net-payout figures are available in TechTools for TikTok Shop sales today. Do not infer profitability from `channel_orders.gross_amount` alone — it is a gross figure with no fees deducted.

---

## 12. Enable writes gradually — do not skip this warning

**Nothing in this phase can write to TikTok.** There is no button, flag, or configuration anywhere in this deployment that would cause TechTools to push a product update, a stock change, or a fulfilment status to TikTok Shop. `commerce_channel_accounts.sync_mode` is database-constrained to `READ_ONLY`/`DIFF_ONLY` — there is no write-capable value to switch to.

This phase has already been through one production-hardening round (see `docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md`'s "Production Review Round 1") — that round hardened the read-only/import path itself (order integrity, idempotency, out-of-order events, IDOR, retry/backoff), it did **not** add any write capability. If a future phase adds write capability:

1. It must go through its own dedicated hardening round first, focused specifically on the new write path (real-Postgres verification of any new schema, OAuth/webhook/market-scope/token-encryption re-audit, and — critically — a real reconciliation story for "what happens if TechTools' write succeeds but the confirmation is lost").
2. Enable exactly one write capability at a time (e.g. inventory-write before product-write), never all at once.
3. Start with a single, low-risk SKU before trusting it for the full catalog.
4. Never enable ad-spend or budget-write capability — this integration should never be able to spend money on TikTok's behalf, by design, indefinitely.

---

## Troubleshooting quick reference

| Symptom | Likely cause | Where to look |
|---|---|---|
| Connect button fails immediately | `CHANNEL_TIKTOK_SHOP_ENABLED` not `true`, or App Key/Secret unset | Production env vars (§3) |
| OAuth redirects but callback errors | Redirect URI mismatch between Partner Center and `CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS` | §1.6, §3 |
| Connection shows `TOKEN_EXPIRED` | Access token genuinely expired (reportedly ~24h) and hasn't been refreshed yet | Reconnect from the Connection page |
| Connection shows `NEEDS_CREDENTIALS` after a webhook | TikTok sent a `SELLER_DEAUTHORIZATION` event — the shop revoked access on TikTok's side | Reconnect after confirming why access was revoked |
| A listing stays "unmapped" after preview | SKU mismatch between TechTools `products.sku` and TikTok's `seller_sku` | Compare exact strings, §6.5 |
| Inventory diff flags every SKU | TechTools inventory and TikTok inventory have genuinely diverged, or a diff was never run before | Investigate which side is stale; this system never auto-resolves |
| Orders not appearing | Worker not running (`CHANNEL_SYNC_QUEUE_ENABLED=false` or `CHANNEL_ORDER_IMPORT_WORKER_ENABLED=false`), or the order predates the current checkpoint | Check env config; use "Import now," or "Backfill" for older orders (§8) |
| Webhook events show `signature_valid: false` | Mismatched `CHANNEL_TIKTOK_SHOP_APP_SECRET` between Partner Center and production | §9.4 |
| An order sits in "Needs reconciliation" | TikTok returned an order with an unparseable amount, missing currency, or malformed payload — it genuinely cannot be imported as-is | §8, step 5 -- investigate the specific reason shown, fix the underlying data issue, then re-import |
| An order's status seems "stuck" on an older value | A newer status was already recorded, and a subsequent delayed/out-of-order update was correctly ignored (not a bug) | Check `channel_activity_log` for an `ORDER_IMPORT_STALE_EVENT_IGNORED` entry for that order |
| A sync run shows `status = 'failed'` in `channel_sync_runs` | Pagination failed partway (rate-limited past the retry budget, or a transport error) -- whatever orders WERE fetched before the failure were still imported | The next poll retries from the same checkpoint automatically; no orders are skipped |
