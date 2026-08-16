-- =====================================================
-- COMMERCE CHANNEL FOUNDATION (TIKTOK-COMMERCE-1)
-- =====================================================
-- Generic, reusable "external sales channel" architecture -- Phase 1 wires
-- up exactly one channel (TikTok Shop, the Partner Center commerce API),
-- but every table here is named/shaped so a future channel (Amazon, eBay)
-- reuses these same tables rather than requiring a rebuild. This file is
-- the connection/webhook/audit foundation, with zero dependency on the
-- product/order/sync domain tables added in 046_commerce_channel_sync.sql
-- (same two-file split PROMOTION-OPS-1 used for 042/043, for the same
-- reason: each file stays independently applicable/testable).
--
-- IMPORTANT -- do not confuse this with PROMOTION-OPS-1's social_connections
-- table or tiktok.adapter.ts (services/social-adapters/). Those cover the
-- entirely separate "TikTok for Developers" Content Posting API (organic
-- video publishing). This file covers the unrelated TikTok Shop Partner
-- Center commerce API (auth.tiktok-shops.com / open-api.tiktokglobalshop.com)
-- -- products, orders, inventory, fulfilment, finance. Nothing here touches
-- social_connections or the social_platform enum, and nothing should.
--
-- Migration number authority: this repository's newest prior migration is
-- 044_brand_trending_fields.sql. This file assumes that remains the latest
-- migration actually recorded in the production schema_migrations table.
-- Verify with:
--   SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 5;
-- before applying -- if a newer migration already exists in production that
-- this repository doesn't have, STOP and renumber this file first.

CREATE TYPE commerce_channel_account_status AS ENUM (
    'DISCONNECTED',
    'CONNECTED',
    'TOKEN_EXPIRED',
    'NEEDS_CREDENTIALS',
    'APP_REVIEW_REQUIRED',
    'DISABLED_BY_ADMIN',
    'ERROR'
);

-- =====================================================
-- COMMERCE CHANNEL ACCOUNTS
-- =====================================================
-- One row per connected external-channel shop/account. channel_type is a
-- CHECK constraint on TEXT, not an ENUM like social_platform -- new sales
-- channels are an expected, ongoing addition to this table (unlike social
-- platforms, a small curated list), and a CHECK is far cheaper to extend
-- (a plain migration) than a Postgres ENUM (ALTER TYPE ... ADD VALUE has
-- its own transactional restrictions). Only 'TIKTOK_SHOP' exists today.
CREATE TABLE IF NOT EXISTS commerce_channel_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_type TEXT NOT NULL CHECK (channel_type IN ('TIKTOK_SHOP')),
    display_name TEXT,
    external_shop_id TEXT,
    -- TikTok's per-shop identifier required on every Shop API call
    -- alongside the access token. Not a secret -- do not encrypt, but also
    -- never expose it as though it were a customer-facing value.
    shop_cipher TEXT,
    -- Required, never inferred or defaulted -- the literal fix for "do not
    -- hardcode TikTok = Italy anywhere in canonical architecture." Every
    -- channel account must state its own market and currency explicitly.
    market_country TEXT NOT NULL,
    market_currency TEXT NOT NULL,
    status commerce_channel_account_status NOT NULL DEFAULT 'DISCONNECTED',
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    -- Mirrors social_connections.token_encryption_key_version exactly, but
    -- keyed against its own CHANNEL_TOKEN_ENCRYPTION_KEY env var/version
    -- map in secret-encryption.ts -- never shares a key namespace with the
    -- unrelated social-publishing tokens.
    token_encryption_key_version INTEGER NOT NULL DEFAULT 1,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    connected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    last_error TEXT,
    disabled_by_admin BOOLEAN NOT NULL DEFAULT false,
    -- Phase 1 safety invariant: no write-capable value exists in this
    -- constraint at all. A future write-enabled phase adds one under a new
    -- CHECK (a real, reviewable migration), never a silent code-level
    -- bypass of a flag that already claims to allow it.
    sync_mode TEXT NOT NULL DEFAULT 'READ_ONLY' CHECK (sync_mode IN ('READ_ONLY', 'DIFF_ONLY')),
    -- Non-secret only -- same rule as social_connections.metadata and
    -- promotion_activity_log.metadata. Tokens live only in the two
    -- _encrypted columns above.
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_channel_accounts_type_shop
    ON commerce_channel_accounts(channel_type, external_shop_id)
    WHERE external_shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_channel_accounts_status ON commerce_channel_accounts(status);
CREATE INDEX IF NOT EXISTS idx_commerce_channel_accounts_market ON commerce_channel_accounts(market_country);

COMMENT ON TABLE commerce_channel_accounts IS 'Connected external sales-channel accounts (TikTok Shop today; generic enough for a future Amazon/eBay channel to reuse). Never confuse with social_connections -- that table is for organic social publishing, a different system.';
COMMENT ON COLUMN commerce_channel_accounts.sync_mode IS 'Phase 1 invariant: only READ_ONLY/DIFF_ONLY exist as valid values -- no code path in this phase can ever write to the external channel.';

-- =====================================================
-- CHANNEL WEBHOOK EVENTS
-- =====================================================
-- Structural clone of stripe_webhook_events (013_stripe_integration.sql) --
-- the only existing inbound-webhook precedent in this codebase. Same
-- ON CONFLICT (event id) DO NOTHING idempotency gate, applied here to
-- TikTok's tts_notification_id. TikTok's webhook signature scheme has no
-- timestamp and therefore no cryptographic replay protection (documented
-- in tiktok-shop.webhook-verify.ts) -- this UNIQUE constraint is the real
-- dedup mechanism, not a decorative index.
CREATE TABLE IF NOT EXISTS channel_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable: some topics (e.g. SELLER_DEAUTHORIZATION) may arrive
    -- referencing a shop this deployment can't immediately match.
    channel_account_id UUID REFERENCES commerce_channel_accounts(id) ON DELETE SET NULL,
    tts_notification_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_webhook_events_account ON channel_webhook_events(channel_account_id);
CREATE INDEX IF NOT EXISTS idx_channel_webhook_events_type ON channel_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_channel_webhook_events_received_at ON channel_webhook_events(received_at DESC);

COMMENT ON TABLE channel_webhook_events IS 'Idempotency ledger for inbound channel webhooks (TikTok Shop today). UNIQUE(tts_notification_id) is the real dedup gate -- the signature scheme itself has no replay protection.';

-- =====================================================
-- CHANNEL ACTIVITY LOG
-- =====================================================
-- Structural clone of promotion_activity_log -- free-text action + JSONB
-- metadata + nullable actor, rather than a closed enum like
-- staff_audit_log (which is scoped to staff-management actions only and
-- was judged the wrong precedent to reuse here).
CREATE TABLE IF NOT EXISTS channel_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    -- Forward reference to channel_sync_runs, which only exists as of
    -- 046_commerce_channel_sync.sql -- FK constraint added there as a
    -- trailing patch-up, same pattern 042/043 used for
    -- social_publish_attempts/social_metric_snapshots -> promotion_channel_posts.
    sync_run_id UUID,
    -- NULL = a system/worker event (a scheduled sync tick), not a human
    -- action -- same convention as promotion_activity_log.actor_user_id.
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_activity_log_account_id ON channel_activity_log(channel_account_id);
CREATE INDEX IF NOT EXISTS idx_channel_activity_log_created_at ON channel_activity_log(created_at DESC);

COMMENT ON TABLE channel_activity_log IS 'Immutable audit trail for channel connection/sync lifecycle events. Never stores tokens/credentials. actor_user_id NULL = system/worker event.';
