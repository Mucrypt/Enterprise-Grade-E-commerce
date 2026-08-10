-- =====================================================
-- SOCIAL CONNECTIONS (PROMOTION-OPS-1 foundation, part 1 of 2)
-- =====================================================
-- Foundation tables for connecting company-owned social accounts (Facebook,
-- Instagram, TikTok, LinkedIn, Pinterest, X) and recording every publish
-- attempt/metric snapshot against them. Deliberately split from
-- 043_promotion_campaigns.sql so this file has zero dependency on the
-- campaign/content domain -- 043 gets a clean forward FK to
-- social_connections with no ALTER TABLE patch-up. The reverse (this file's
-- two ledger tables referencing promotion_channel_posts, which doesn't
-- exist yet) is the one deliberate exception: channel_post_id is declared
-- as a plain UUID NOT NULL here with no FK, and 043 adds the FK constraint
-- once its own table exists. See docs/SOCIAL-PUBLISHING-ARCHITECTURE.md.
--
-- No live Postgres connection was available to verify this against a real
-- schema_migrations table when this file was written (confirmed via
-- `pg_isready` failure in the working environment) -- verify the actual
-- next-free migration number in the target database before applying.

CREATE TYPE social_platform AS ENUM (
    'FACEBOOK',
    'INSTAGRAM',
    'TIKTOK',
    'LINKEDIN',
    'PINTEREST',
    'X'
);

CREATE TYPE social_connection_status AS ENUM (
    'DISCONNECTED',
    'CONNECTED',
    'TOKEN_EXPIRED',
    'NEEDS_CREDENTIALS',
    'MISSING_PERMISSION',
    'APP_REVIEW_REQUIRED',
    'DISABLED_BY_ADMIN',
    'ERROR'
);

-- =====================================================
-- SOCIAL CONNECTIONS
-- =====================================================
-- A connected company page/profile on one platform. Multiple connections
-- per platform are intentionally allowed (e.g. two Facebook Pages), so
-- there is no UNIQUE(platform) constraint -- only a unique connection per
-- (platform, external_account_id) once the remote account id is known.
--
-- access_token_encrypted/refresh_token_encrypted are opaque ciphertext
-- strings produced by src/utils/secret-encryption.ts (AES-256-GCM) -- NEVER
-- plaintext. Unlike this codebase's pre-existing
-- email_sender_aliases.smtp_pass_encrypted (which despite its name is
-- stored and read as plain text, confirmed during this phase's audit),
-- these columns are backed by real authenticated encryption from day one.
-- Application code must never serialize these two columns into any API
-- response, log line, or audit_log/activity_log metadata field.

CREATE TABLE IF NOT EXISTS social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform social_platform NOT NULL,
    display_name TEXT,
    external_account_id TEXT,
    status social_connection_status NOT NULL DEFAULT 'DISCONNECTED',
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    -- Which key version encrypted the two columns above, so a future
    -- key-rotation job can decrypt under the old key and re-encrypt under
    -- the new one row by row. See secret-encryption.ts's header comment
    -- for the documented (not yet implemented) rotation plan.
    token_encryption_key_version INTEGER NOT NULL DEFAULT 1,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    connected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    last_error TEXT,
    disabled_by_admin BOOLEAN NOT NULL DEFAULT false,
    -- Non-secret operational metadata only (e.g. page category, follower
    -- count at connect time). Never store tokens or credentials here --
    -- this column IS returned to the admin browser.
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_social_connections_platform_external
    ON social_connections (platform, external_account_id)
    WHERE external_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_status ON social_connections(status);

COMMENT ON TABLE social_connections IS 'Connected company social accounts (one row per connected page/profile). Token columns are AES-256-GCM ciphertext (src/utils/secret-encryption.ts) -- never plaintext, never returned to the browser.';
COMMENT ON COLUMN social_connections.metadata IS 'Non-secret operational metadata only. Never store tokens/credentials here -- this column is returned to the admin browser as-is.';

-- =====================================================
-- SOCIAL PUBLISH ATTEMPTS
-- =====================================================
-- Append-only ledger of every publish attempt for a promotion_channel_posts
-- row (table defined in 043_promotion_campaigns.sql -- see this file's
-- header comment for why the FK is added there, not here). This table IS
-- the idempotency audit trail: promotion-campaign.queue.ts always writes
-- one row per attempt before/around the external call, so a crashed-mid-
-- call retry can be reasoned about from real records instead of guessing.

CREATE TABLE IF NOT EXISTS social_publish_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_post_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL,
    dry_run BOOLEAN NOT NULL DEFAULT true,
    -- Adapter-generated outbound payload for debugging -- never tokens.
    request_payload JSONB NOT NULL DEFAULT '{}',
    response_status TEXT NOT NULL,
    remote_post_id TEXT,
    error_code TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_social_publish_attempts_post_attempt
    ON social_publish_attempts (channel_post_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_social_publish_attempts_channel_post_id ON social_publish_attempts(channel_post_id);

COMMENT ON TABLE social_publish_attempts IS 'Append-only per-attempt ledger for channel post publishing -- the idempotency audit trail. FK to promotion_channel_posts added in 043_promotion_campaigns.sql.';
COMMENT ON COLUMN social_publish_attempts.request_payload IS 'Adapter-generated outbound payload for debugging. Never contains access/refresh tokens.';

-- =====================================================
-- SOCIAL METRIC SNAPSHOTS
-- =====================================================
-- Point-in-time engagement metrics fetched from a platform's API for a
-- published post. Stored as periodic snapshots (not live-queried on every
-- page view) to respect provider rate limits -- see
-- promotion-campaign.queue.ts's metrics-sync phase. Metric columns are
-- nullable, never zero-filled: a platform that doesn't return a given
-- metric leaves it NULL, which is a different fact from "confirmed zero."

CREATE TABLE IF NOT EXISTS social_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_post_id UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    impressions BIGINT,
    reach BIGINT,
    likes BIGINT,
    comments BIGINT,
    shares BIGINT,
    clicks BIGINT,
    -- Whatever else the provider's API returns that doesn't map to one of
    -- the named columns above (e.g. video_views, saves) -- never fabricated.
    raw_metrics JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_social_metric_snapshots_channel_post_id ON social_metric_snapshots(channel_post_id);
CREATE INDEX IF NOT EXISTS idx_social_metric_snapshots_captured_at ON social_metric_snapshots(captured_at DESC);

COMMENT ON TABLE social_metric_snapshots IS 'Periodic engagement-metric snapshots per channel post. NULL means the provider does not report that metric -- never zero-filled. FK to promotion_channel_posts added in 043_promotion_campaigns.sql.';
