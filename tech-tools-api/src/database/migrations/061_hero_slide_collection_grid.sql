-- =====================================================
-- Hero Slide Collection Grid
-- Version: 061
-- Description: A new 'collection_grid' hero slide type -- several real,
--              admin-picked product_collections shown together as tiles
--              in one slide (each tile = a collection's own banner photo
--              + name, linking to /collections/:slug), mirroring the
--              existing 'product_grid' type exactly but one level up
--              (collections instead of individual products).
-- =====================================================

ALTER TABLE hero_slides DROP CONSTRAINT hero_slides_slide_type_check;
ALTER TABLE hero_slides ADD CONSTRAINT hero_slides_slide_type_check CHECK (slide_type IN
    ('custom', 'product', 'category', 'product_collection', 'category_collection', 'product_grid', 'collection_grid'));

ALTER TABLE hero_slides DROP CONSTRAINT valid_slide_reference;
ALTER TABLE hero_slides ADD CONSTRAINT valid_slide_reference CHECK (
  (slide_type IN ('custom', 'product_grid', 'collection_grid')
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
);

-- Junction table for 'collection_grid' slides -- mirrors hero_slide_items
-- exactly, referencing product_collections instead of products.
CREATE TABLE IF NOT EXISTS hero_slide_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_slide_id UUID NOT NULL REFERENCES hero_slides(id) ON DELETE CASCADE,
    product_collection_id UUID NOT NULL REFERENCES product_collections(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_collection_in_hero_slide UNIQUE (hero_slide_id, product_collection_id),
    CONSTRAINT valid_hero_slide_collection_position CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_hero_slide_collections_slide ON hero_slide_collections(hero_slide_id, position);

COMMENT ON TABLE hero_slide_collections IS 'Product collections shown together as tiles in one collection_grid-type hero slide';
