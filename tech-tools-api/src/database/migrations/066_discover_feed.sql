-- Discover Feed (Phase 1) -- admin/staff-only shoppable video/image feed.
-- Every post ties to one or more real products via discover_post_products
-- (same junction-table + position pattern as hero_slide_items). Ranking is
-- computed from real, transactionally-maintained counters -- no fabricated
-- stats, no personalization model yet (see discover.controller.ts).

CREATE TABLE IF NOT EXISTS discover_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('video', 'image')),
    video_url TEXT,
    video_poster_url TEXT,
    caption TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    position INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    add_to_cart_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT discover_post_video_requires_url CHECK (media_type != 'video' OR video_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_discover_posts_active ON discover_posts(is_active, position DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discover_posts_category ON discover_posts(category_id);

-- Image-carousel posts only (media_type = 'image').
CREATE TABLE IF NOT EXISTS discover_post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discover_post_id UUID NOT NULL REFERENCES discover_posts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    UNIQUE(discover_post_id, position)
);

-- Mirrors hero_slide_items exactly (see 059_hero_slides.sql).
CREATE TABLE IF NOT EXISTS discover_post_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discover_post_id UUID NOT NULL REFERENCES discover_posts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discover_post_id, product_id),
    CONSTRAINT valid_discover_post_product_position CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_discover_post_products_post ON discover_post_products(discover_post_id, position);

-- Per-user, so "already liked/saved" state and accurate unlike/unsave work.
CREATE TABLE IF NOT EXISTS discover_post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discover_post_id UUID NOT NULL REFERENCES discover_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discover_post_id, user_id)
);

-- Post bookmark (rewatch later) -- distinct from the product-scoped wishlist.
CREATE TABLE IF NOT EXISTS discover_post_saves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discover_post_id UUID NOT NULL REFERENCES discover_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discover_post_id, user_id)
);

-- Real purchase attribution: threads a post id through the cart -> checkout
-- -> order pipeline so "purchases" in the ranking formula is an actual
-- count, not a proxy. Nullable -- most order items have no feed origin.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discover_post_id UUID REFERENCES discover_posts(id) ON DELETE SET NULL;

-- New ranking/analytics event types for the existing batched event-tracking
-- pipeline (events_core.event_type). Safe inside this migration's own
-- transaction on Postgres 13+ as long as no statement in the same
-- transaction tries to *use* the new values (verified against a throwaway
-- Postgres 16 instance).
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'discover_view';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'discover_watch_complete';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'discover_replay';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'discover_product_card_open';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'discover_skip';
