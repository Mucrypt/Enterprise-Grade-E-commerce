-- =====================================================
-- Seed Default Hero Slides
-- Version: 060
-- Description: Migration 059 seeded exactly one 'custom' hero slide
--              (the legacy homepage_settings.hero copy, no image) and
--              nothing else -- the old ToolsHero auto-populated several
--              more slides at request time from whatever was currently
--              is_featured/in-stock, which the new admin-curated model
--              deliberately does not do automatically. Deploying 059
--              alone therefore visibly regresses the live homepage from
--              a multi-slide auto-advancing carousel to one bare,
--              non-advancing slide with no photo.
--
--              This migration bootstraps a sensible default state so a
--              fresh deploy doesn't look broken: a handful of real
--              'product' slides from currently featured, in-stock
--              products, one 'product_collection' slide from the first
--              real featured collection with a banner, and a real photo
--              background for the existing custom slide. All of this is
--              a one-time bootstrap -- if an admin has already added any
--              non-custom slide (via the new Hero Slides admin page),
--              this entire block is skipped, so it never clobbers real
--              admin curation.
-- =====================================================

DO $$
DECLARE
  already_seeded boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM hero_slides WHERE slide_type <> 'custom') INTO already_seeded;

  IF NOT already_seeded THEN
    INSERT INTO hero_slides (slide_type, product_id, position, platform)
    SELECT 'product', sub.id, sub.rn, 'both'
    FROM (
      SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.created_at DESC) AS rn
      FROM products p
      WHERE p.is_active = TRUE
        AND p.is_featured = TRUE
        AND p.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM inventory i
          WHERE i.product_id = p.id AND i.available_stock > 0
        )
      ORDER BY p.created_at DESC
      LIMIT 4
    ) sub;

    INSERT INTO hero_slides (slide_type, product_collection_id, position, platform)
    SELECT 'product_collection', pc.id, 5, 'both'
    FROM product_collections pc
    WHERE pc.is_active = TRUE
      AND pc.is_featured = TRUE
      AND pc.visibility = 'public'
      AND (pc.banner_url IS NOT NULL OR pc.image_url IS NOT NULL)
    ORDER BY pc.created_at DESC
    LIMIT 1;

    -- Give the migrated custom slide a real photo background (the old
    -- "brand" slide always showed one) instead of the plain gradient
    -- fallback -- only if it doesn't already have one.
    UPDATE hero_slides
    SET image_url = (
      SELECT pm.url
      FROM product_media pm
      JOIN products p ON p.id = pm.product_id
      WHERE p.is_active = TRUE AND p.is_featured = TRUE AND pm.type = 'image'
      ORDER BY pm.is_primary DESC, pm.position
      LIMIT 1
    )
    WHERE slide_type = 'custom' AND position = 0 AND image_url IS NULL;
  END IF;
END $$;
