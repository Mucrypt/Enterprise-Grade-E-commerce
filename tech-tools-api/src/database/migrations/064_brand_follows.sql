-- Real brand-follow relationships, replacing the client-side-only
-- "Follow" button on the Trending pages (web + mobile) that previously
-- reset on every refresh and had no backend at all.
CREATE TABLE IF NOT EXISTS brand_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_follows_user ON brand_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_follows_brand ON brand_follows(brand_id);
