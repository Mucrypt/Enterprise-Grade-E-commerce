-- =====================================================
-- PROMOTION CAMPAIGNS (PROMOTION-OPS-1 foundation, part 2 of 2)
-- =====================================================
-- The campaign/content domain: a promotion_campaigns row is the business
-- campaign (e.g. "Cordless Tools Weekend Sale"); each one may fan out into
-- multiple promotion_channel_posts rows (one per social platform), each
-- published/tracked completely independently -- a Facebook failure must
-- never roll back an already-succeeded Instagram post. See
-- docs/SOCIAL-PUBLISHING-ARCHITECTURE.md for the full design rationale.
--
-- Deliberately does NOT touch newsletter_campaigns (stays newsletter-only)
-- or the unified analytics event tables -- outbound links carry standard
-- UTM parameters (see src/api/v1/promotions/promotion.utm.ts) picked up by
-- the EXISTING Analytics 2.0 Acquisition endpoint via
-- user_sessions.utm_source/utm_medium/utm_campaign; no second attribution
-- engine is introduced here.
--
-- No live Postgres connection was available to verify this against a real
-- schema_migrations table when this file was written (confirmed via
-- `pg_isready` failure in the working environment) -- verify the actual
-- next-free migration number in the target database before applying.
-- Production Review Round 1 subsequently applied 001-043 (with two
-- unrelated, pre-existing, documented FK gaps in 016/026 worked around in
-- a throwaway local Postgres 16 instance, never in this repo's files) to
-- confirm this file's real structural correctness -- see
-- docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md's Production Review Round
-- 1 section.
--
-- Production Review Round 1 also revised the two status enums below
-- BEFORE this migration was ever applied anywhere (safe to do -- see that
-- report): the original design let a dry-run channel post become
-- indistinguishable from a genuinely published one (status='PUBLISHED'
-- with a synthetic remote_post_id) -- rejected as unacceptable historical
-- truth. DRY_RUN_SUCCEEDED and DRY_RUN_COMPLETED are now the only status
-- a simulated publish can ever reach. REQUIRES_ACTION was added for the
-- case where a real publish attempt's outcome is genuinely unknown (e.g.
-- the HTTP request may or may not have reached the provider before the
-- connection failed) -- such a channel is never auto-retried, since a
-- retry could create a real duplicate post if the first attempt actually
-- succeeded.

CREATE TYPE promotion_campaign_status AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'PUBLISHING',
    'PARTIAL_SUCCESS',
    'PUBLISHED',
    'FAILED',
    'CANCELLED',
    'DRY_RUN_COMPLETED'
);

CREATE TYPE promotion_channel_post_status AS ENUM (
    'DRAFT',
    'QUEUED',
    'PUBLISHING',
    'PUBLISHED',
    'FAILED',
    'CANCELLED',
    'DRY_RUN_SUCCEEDED',
    'REQUIRES_ACTION'
);

-- =====================================================
-- PROMOTION CAMPAIGNS
-- =====================================================

CREATE TABLE IF NOT EXISTS promotion_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Slugified, unique -- this is the literal utm_campaign value on every
    -- outbound link for this campaign, across every channel.
    campaign_key TEXT NOT NULL,
    status promotion_campaign_status NOT NULL DEFAULT 'DRAFT',
    -- Free text, not an enum -- marketing objectives (AWARENESS, TRAFFIC,
    -- SALES, PRODUCT_LAUNCH, ...) are labels for humans, not a value this
    -- system branches logic on; a free column avoids a migration every
    -- time marketing wants a new label.
    objective TEXT,
    master_message TEXT NOT NULL DEFAULT '',
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    landing_url TEXT,
    -- [{key, url, variant, width, height, mediaType}] -- keys point into
    -- media-storage.service.ts-managed storage under campaigns/creatives/.
    creative_assets JSONB NOT NULL DEFAULT '[]',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Schema-only this phase -- NOT enforced by any query yet (no
    -- applyMarketScope('promotions') exists). A deliberate, documented
    -- no-op rather than a silently half-wired feature; see
    -- docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md's known-gaps section.
    market_scope TEXT[],
    -- Snapshots SOCIAL_PUBLISH_DRY_RUN at the moment this campaign is
    -- scheduled/published, so a later env flip from dry-run to live never
    -- retroactively relabels a campaign's own history.
    dry_run BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_promotion_campaigns_campaign_key ON promotion_campaigns(campaign_key);
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_status ON promotion_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_created_by ON promotion_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_scheduled_at ON promotion_campaigns(scheduled_at) WHERE status = 'SCHEDULED';

COMMENT ON TABLE promotion_campaigns IS 'The business marketing campaign. Fans out into one promotion_channel_posts row per selected social platform, each independently published/tracked.';
COMMENT ON COLUMN promotion_campaigns.campaign_key IS 'Slugified, unique. The literal utm_campaign value on every outbound link for this campaign.';
COMMENT ON COLUMN promotion_campaigns.market_scope IS 'Schema-only this phase -- not enforced by any query yet. See PROMOTION-OPS-1 known gaps.';
COMMENT ON COLUMN promotion_campaigns.dry_run IS 'Snapshot of SOCIAL_PUBLISH_DRY_RUN at schedule/publish time -- a later env flip never retroactively relabels a campaign''s own history.';

-- =====================================================
-- PROMOTION CAMPAIGN PRODUCTS
-- =====================================================
-- A real join table, not a JSONB blob on promotion_campaigns -- deliberate.
-- Snapshotting only 4-5 display fields (not the whole product row) avoids
-- unnecessary duplication, while keeping a real product_id FK preserves the
-- ability to query "which campaigns feature product X" (a reporting/badge
-- use case a JSONB array can't serve without an unindexable workaround).
-- product_id is ON DELETE SET NULL, not CASCADE -- a deleted product must
-- not delete campaign history; the snapshot columns keep the row
-- meaningful even once the FK is gone.

CREATE TABLE IF NOT EXISTS promotion_campaign_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    snapshot_name TEXT NOT NULL,
    snapshot_slug TEXT,
    snapshot_price NUMERIC(12, 2),
    snapshot_currency TEXT,
    snapshot_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_promotion_campaign_products_campaign_product
    ON promotion_campaign_products (campaign_id, product_id)
    WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotion_campaign_products_campaign_id ON promotion_campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promotion_campaign_products_product_id ON promotion_campaign_products(product_id);

COMMENT ON TABLE promotion_campaign_products IS 'Products featured in a campaign -- a real join table with a snapshot of display fields, not a JSONB duplicate of the product row. See table header for the join-vs-JSONB rationale.';

-- =====================================================
-- PROMOTION CHANNEL POSTS
-- =====================================================
-- One row per (campaign, platform) -- the unit of independent publishing.
-- Every lifecycle field lives here, not on the parent campaign, so one
-- channel's failure is structurally incapable of touching another's state.

CREATE TABLE IF NOT EXISTS promotion_channel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    channel social_platform NOT NULL,
    connection_id UUID REFERENCES social_connections(id) ON DELETE SET NULL,
    status promotion_channel_post_status NOT NULL DEFAULT 'DRAFT',
    -- NULL falls back to promotion_campaigns.master_message at render/
    -- publish time -- distinguishes "never customized" from "customized to
    -- an empty string", which a plain default '' could not.
    message_override TEXT,
    hashtags TEXT[] NOT NULL DEFAULT '{}',
    -- References a key inside promotion_campaigns.creative_assets.
    creative_asset_key TEXT,
    -- Final UTM-tagged URL actually used for THIS channel's post.
    link_url TEXT,
    scheduled_at TIMESTAMPTZ,
    queued_at TIMESTAMPTZ,
    publishing_started_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    -- Presence of this column is the queue worker's idempotency check --
    -- a row that already has one is never re-published, only re-verified.
    remote_post_id TEXT,
    remote_permalink TEXT,
    last_error TEXT,
    -- Machine-readable classification of the last failure (e.g.
    -- 'AUTH_EXPIRED', 'RATE_LIMITED', 'REMOTE_STATE_UNKNOWN',
    -- 'STUCK_PUBLISHING_TIMEOUT') -- last_error stays the human-readable
    -- message; this is what the queue/UI branch on. See
    -- promotion-campaign.queue.ts's error-classification logic.
    last_error_code TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    dry_run BOOLEAN NOT NULL DEFAULT true,
    -- Structured output of the adapter's validatePost() -- surfaced as-is
    -- in the composer's Review & Validate step.
    validation_errors JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_promotion_channel_posts_campaign_channel
    ON promotion_channel_posts (campaign_id, channel);
CREATE INDEX IF NOT EXISTS idx_promotion_channel_posts_campaign_id ON promotion_channel_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promotion_channel_posts_status ON promotion_channel_posts(status);
CREATE INDEX IF NOT EXISTS idx_promotion_channel_posts_next_attempt
    ON promotion_channel_posts(next_attempt_at) WHERE status = 'QUEUED';

COMMENT ON TABLE promotion_channel_posts IS 'One row per (campaign, platform) -- the unit of independent publishing. A failure on one row never affects another. remote_post_id presence is the idempotency guard the queue worker checks before ever calling an adapter''s publish().';
COMMENT ON COLUMN promotion_channel_posts.message_override IS 'NULL = inherit promotion_campaigns.master_message. Distinguished from an explicit empty string, which a caller could set deliberately.';

-- =====================================================
-- PROMOTION ACTIVITY LOG
-- =====================================================
-- Immutable (by convention, same as staff_audit_log) audit trail. Never
-- stores tokens/credentials -- same rule as social_connections.metadata.

CREATE TABLE IF NOT EXISTS promotion_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES promotion_campaigns(id) ON DELETE CASCADE,
    channel_post_id UUID REFERENCES promotion_channel_posts(id) ON DELETE CASCADE,
    -- NULL = a system/worker event (e.g. an automated retry), not a human
    -- action.
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_activity_log_campaign_id ON promotion_activity_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promotion_activity_log_created_at ON promotion_activity_log(created_at DESC);

COMMENT ON TABLE promotion_activity_log IS 'Immutable audit trail for campaign/channel-post lifecycle events. Never stores tokens/credentials. actor_user_id NULL = system/worker event.';

-- =====================================================
-- Forward FK patch-up: 042_social_connections.sql's two ledger tables
-- reference promotion_channel_posts, which only exists as of this file.
-- =====================================================

ALTER TABLE social_publish_attempts
    ADD CONSTRAINT fk_social_publish_attempts_channel_post
    FOREIGN KEY (channel_post_id) REFERENCES promotion_channel_posts(id) ON DELETE CASCADE;

ALTER TABLE social_metric_snapshots
    ADD CONSTRAINT fk_social_metric_snapshots_channel_post
    FOREIGN KEY (channel_post_id) REFERENCES promotion_channel_posts(id) ON DELETE CASCADE;
