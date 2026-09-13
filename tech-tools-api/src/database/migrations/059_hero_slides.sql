-- =====================================================
-- Hero Slides CMS Migration
-- Version: 059
-- Description: Admin-managed homepage hero carousel -- replaces the
--              auto-generated slide list (whatever happened to be
--              is_featured + in-stock) with an explicit, ordered,
--              admin-curated list of slides. Each slide is either a
--              plain marketing banner, a single product, a single
--              category, a real product/category collection (reusing
--              the existing collections system for a banner-style
--              slide), or a "product_grid" slide showing several real
--              products together in one slide via its own hero-only
--              items table (deliberately NOT product_collection_items --
--              editing a real storefront collection's items must never
--              silently change a hero slide, or vice versa).
-- =====================================================

CREATE TABLE IF NOT EXISTS hero_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_type VARCHAR(20) NOT NULL CHECK (slide_type IN
        ('custom', 'product', 'category', 'product_collection', 'category_collection', 'product_grid')),

    -- Copy -- all nullable; product/category/collection slides fall back
    -- to the referenced entity's own name/description when null, same
    -- fallback philosophy the old auto-generated slides already used.
    -- 'custom' and 'product_grid' have no entity to fall back to, so an
    -- admin must fill these in for those two types (enforced in the API
    -- layer, not here).
    eyebrow VARCHAR(120),
    title VARCHAR(255),
    description TEXT,
    image_url TEXT,
    cta_label VARCHAR(60),
    cta_link VARCHAR(255),
    secondary_cta_label VARCHAR(60),
    secondary_cta_link VARCHAR(255),

    -- Exactly one of these four is populated, matching slide_type -- see
    -- valid_slide_reference below.
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    product_collection_id UUID REFERENCES product_collections(id) ON DELETE CASCADE,
    category_collection_id UUID REFERENCES category_collections(id) ON DELETE CASCADE,

    is_active BOOLEAN DEFAULT TRUE,
    position INTEGER DEFAULT 0,
    -- Which storefront(s) this slide appears on -- 'both' is the common
    -- case; 'web'/'mobile' lets an admin run a platform-specific promo.
    platform VARCHAR(10) DEFAULT 'both' CHECK (platform IN ('both', 'web', 'mobile')),

    starts_at TIMESTAMP,
    ends_at TIMESTAMP,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_hero_slide_position CHECK (position >= 0),
    CONSTRAINT valid_hero_slide_schedule CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
    CONSTRAINT valid_slide_reference CHECK (
      (slide_type IN ('custom', 'product_grid')
         AND product_id IS NULL AND category_id IS NULL
         AND product_collection_id IS NULL AND category_collection_id IS NULL)
      OR (slide_type = 'product' AND product_id IS NOT NULL
         AND category_id IS NULL AND product_collection_id IS NULL AND category_collection_id IS NULL)
      OR (slide_type = 'category' AND category_id IS NOT NULL
         AND product_id IS NULL AND product_collection_id IS NULL AND category_collection_id IS NULL)
      OR (slide_type = 'product_collection' AND product_collection_id IS NOT NULL
         AND product_id IS NULL AND category_id IS NULL AND category_collection_id IS NULL)
      OR (slide_type = 'category_collection' AND category_collection_id IS NOT NULL
         AND product_id IS NULL AND category_id IS NULL AND product_collection_id IS NULL)
    )
);

-- Junction table for 'product_grid' slides -- up to a handful of real
-- products shown together in one slide. Deliberately its own table, not
-- product_collection_items (see migration header comment).
CREATE TABLE IF NOT EXISTS hero_slide_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_slide_id UUID NOT NULL REFERENCES hero_slides(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_product_in_hero_slide UNIQUE (hero_slide_id, product_id),
    CONSTRAINT valid_hero_slide_item_position CHECK (position >= 0)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_hero_slides_position ON hero_slides(position) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hero_slides_platform ON hero_slides(platform, is_active);
CREATE INDEX IF NOT EXISTS idx_hero_slides_schedule ON hero_slides(starts_at, ends_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hero_slide_items_slide ON hero_slide_items(hero_slide_id, position);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_hero_slides_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hero_slides_timestamp ON hero_slides;
CREATE TRIGGER trigger_update_hero_slides_timestamp
    BEFORE UPDATE ON hero_slides
    FOR EACH ROW
    EXECUTE FUNCTION update_hero_slides_timestamp();

-- =====================================================
-- SEED -- one-time, idempotent migration of today's live hero copy
-- (homepage_settings.hero) into slide position 0, so applying this
-- migration changes nothing visually until an admin edits/adds a slide.
-- =====================================================

INSERT INTO hero_slides (slide_type, eyebrow, title, description, cta_label, cta_link,
                          secondary_cta_label, secondary_cta_link, position, platform)
SELECT 'custom',
       hero->>'eyebrow', hero->>'headline', hero->>'description',
       hero->>'primaryCtaLabel', hero->>'primaryCtaTo',
       hero->>'secondaryCtaLabel', hero->>'secondaryCtaTo',
       0, 'both'
FROM homepage_settings
WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM hero_slides);

COMMENT ON TABLE hero_slides IS 'Admin-managed homepage hero carousel slides -- ordered, schedulable, per-platform';
COMMENT ON TABLE hero_slide_items IS 'Products shown together in one product_grid-type hero slide';
COMMENT ON COLUMN hero_slides.platform IS 'Which storefront(s) show this slide: both, web, or mobile';
