-- Live shopping: a seller broadcasts (via AWS IVS -- any standard RTMP
-- encoder in this phase, an in-app camera broadcaster is real future
-- work, not this migration's concern), viewers watch, a product gets
-- pinned in real time, and a purchase during the stream attributes back
-- to the session -- same shape as discover_post_products/
-- order_items.discover_post_id (066_discover_feed.sql), applied to a
-- live session instead of a static post.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_session_status') THEN
    CREATE TYPE live_session_status AS ENUM ('scheduled', 'live', 'ended', 'errored');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    title VARCHAR(140) NOT NULL,
    status live_session_status NOT NULL DEFAULT 'scheduled',
    -- AWS IVS identifiers. The stream key's ARN only -- the key VALUE
    -- itself is never persisted here, only fetched from AWS via this
    -- ARN when the seller needs to view/rotate it (see ivs.service.ts).
    ivs_channel_arn VARCHAR(255),
    ivs_ingest_endpoint VARCHAR(255),
    ivs_stream_key_arn VARCHAR(255),
    ivs_playback_url TEXT,
    ivs_chat_room_arn VARCHAR(255),
    thumbnail_url TEXT,
    scheduled_start_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    -- Written from AWS IVS's own GetStream viewer count on session end
    -- (polled, authoritative) -- no separate viewer-tracking table this
    -- phase.
    viewer_count_peak INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_seller ON live_sessions(seller_profile_id, created_at DESC);
-- "Who's live now" rail -- the one hot query this table serves on every
-- Discover feed load.
CREATE INDEX IF NOT EXISTS idx_live_sessions_status_live ON live_sessions(status) WHERE status = 'live';

-- Mirrors discover_post_products' shape, kept as a SEPARATE table
-- (not shared) -- a live session's pin state changes continuously
-- during a broadcast, a different lifecycle than a static post's fixed
-- product list.
CREATE TABLE IF NOT EXISTS live_session_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMP WITH TIME ZONE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(live_session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_products_session ON live_session_products(live_session_id, display_order);
-- At most one pinned product per session at a time (the "shop this"
-- spotlight is singular, matching how a live-shopping overlay actually
-- reads on screen) -- enforced here, not just in application code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_session_products_one_pinned
  ON live_session_products(live_session_id)
  WHERE is_pinned = TRUE;

-- Purchase attribution during a live stream -- identical precedent to
-- order_items.discover_post_id.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL;
