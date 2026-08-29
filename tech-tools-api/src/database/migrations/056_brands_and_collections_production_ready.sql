-- ============================================================
-- Migration 056: Production-ready brands and collections
-- ============================================================
-- Two real, concrete gaps found in the live catalog:
--
-- 1. Brands: the 8 existing brands are all automotive-themed
--    house brands (BrightBeam for lighting, DriveMaster for
--    performance parts, etc). Since migration 055 added the
--    "Home Improvement & Tools" taxonomy, 6 real products in
--    that space had brand_id = NULL -- that category had zero
--    brand coverage. Two of those products' own sourced
--    descriptions literally state a real brand ("Brand: VEVOR",
--    "Brand: FARYODI") -- those are added as real brands, not
--    invented. The remaining 3 generic tool products (no brand
--    stated in their source data) get grouped into one new
--    in-house brand, "WorkForge", following the exact same
--    precedent as the other 8 house brands.
--
-- 2. Collections: category_collections/product_collections were
--    built (migration 003) and have an admin UI, but were never
--    populated with real curation -- 4 of 5 category collections
--    and 7 of 9 product collections had zero items, and two had
--    actively wrong test data (a woodworking drill jig sitting in
--    the "Wireless CarPlay & Android Auto" collection; the same
--    2 unrelated jigs as the entire "Best Sellers" list). This
--    migration removes the wrong rows and populates every
--    collection with real products/categories, using real signals
--    (units_sold, created_at, sale_price, category theme) rather
--    than arbitrary picks.
-- ============================================================

-- =====================================================
-- 1. NEW BRANDS
-- =====================================================
INSERT INTO brands (name, slug, description, website_url, is_active)
VALUES
  (
    'VEVOR',
    'vevor',
    'Global supplier of professional-grade tools and workshop equipment for tradespeople, woodworkers, and DIY builders.',
    'https://www.vevor.com',
    true
  ),
  (
    'FARYODI',
    'faryodi',
    'Precision drilling guides and cabinet hardware installation tools for furniture and cabinetry work.',
    NULL,
    true
  ),
  (
    'WorkForge',
    'workforge',
    'In-house precision measuring, layout, and workshop essentials for builders, makers, and DIY renovators.',
    NULL,
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. BRAND ASSIGNMENTS for the 6 products that had brand_id
--    NULL. Two matched to their own sourced "Brand:" field;
--    three generic tool products grouped into the new WorkForge
--    house brand; the CarPlay adapter follows the same
--    house-brand precedent already used for every other
--    generic-sourced electronics accessory (OBD2 scanner, tire
--    gauge, wireless charger mount are all already AutoTech Pro).
-- =====================================================
UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'vevor')
WHERE slug = 'vevor-aluminum-alloy';

UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'faryodi')
WHERE slug = 'faryodi-adjustable-cabinet-hardware-drill-guide-blue-766f22d5';

UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'workforge')
WHERE slug IN (
  'kc44-digital-caliper-with-lcd-display-0-100mm-4-29d6d68f',
  'portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb',
  'woodworking-measurement-set-with-a-storage-box-designed-for-planning-and-layout-of-woodworking-projects-including-a-multi-angle-combination-triangle-ruler-angle-sharpening-dovetail-gauge'
);

UPDATE products SET brand_id = (SELECT id FROM brands WHERE slug = 'autotech-pro')
WHERE slug = '2-in-1-wireless-carplay-android-auto-adapter-ultra-fast-low-latency';

-- =====================================================
-- 3. FIX WRONG PRODUCT-COLLECTION DATA
--    "Wireless CarPlay & Android Auto" contained a woodworking
--    drill jig; "Best Sellers" contained the same jig plus one
--    other unrelated woodworking product. Both are removed
--    before real items are inserted below.
-- =====================================================
DELETE FROM product_collection_items
WHERE collection_id = (SELECT id FROM product_collections WHERE slug = 'wireless-carplay-android-auto')
  AND product_id IN (
    SELECT id FROM products WHERE slug = 'portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb'
  );

DELETE FROM product_collection_items
WHERE collection_id = (SELECT id FROM product_collections WHERE slug = 'best-sellers')
  AND product_id IN (
    SELECT id FROM products WHERE slug IN (
      'vevor-aluminum-alloy',
      'portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb'
    )
  );

-- =====================================================
-- 4. POPULATE PRODUCT COLLECTIONS with real products
-- =====================================================

-- Wireless CarPlay & Android Auto -- the one real product that
-- actually matches this collection's name.
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'wireless-carplay-android-auto'), p.id, 0
FROM products p
WHERE p.slug = '2-in-1-wireless-carplay-android-auto-adapter-ultra-fast-low-latency'
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Summer Road Trip Essentials
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'summer-road-trip-essentials'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('portable-jump-starter-power-bank-2000a', 0),
  ('digital-tire-pressure-gauge-backlit', 1),
  ('cordless-car-vacuum-cleaner-12000pa', 2),
  ('collapsible-car-trunk-organizer-cooler', 3),
  ('4k-dual-dash-cam-night-vision-gps', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Best Sellers -- the only 6 products in the catalog with a real
-- units_sold > 0 signal (this is a young store; not padded to a
-- round number with unsold products).
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'best-sellers'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('obd2-bluetooth-scanner-diagnostic-tool', 0),
  ('digital-tire-pressure-gauge-backlit', 1),
  ('collapsible-car-trunk-organizer-cooler', 2),
  ('premium-leather-seat-covers-full-set', 3),
  ('car-interior-led-strip-kit-rgb', 4),
  ('portable-jump-starter-power-bank-2000a', 5)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- New Arrivals -- the 5 tool products are the genuinely newest
-- real products in the catalog (created 2026-08-28, everything
-- else dates to Feb/Mar 2026).
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'new-arrivals'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('kc44-digital-caliper-with-lcd-display-0-100mm-4-29d6d68f', 0),
  ('faryodi-adjustable-cabinet-hardware-drill-guide-blue-766f22d5', 1),
  ('portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb', 2),
  ('vevor-aluminum-alloy', 3),
  ('woodworking-measurement-set-with-a-storage-box-designed-for-planning-and-layout-of-woodworking-projects-including-a-multi-angle-combination-triangle-ruler-angle-sharpening-dovetail-gauge', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Budget Friendly Picks -- the 5 lowest real sale_price products.
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'budget-friendly-picks'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('digital-tire-pressure-gauge-backlit', 0),
  ('kc44-digital-caliper-with-lcd-display-0-100mm-4-29d6d68f', 1),
  ('obd2-bluetooth-scanner-diagnostic-tool', 2),
  ('ultra-bright-led-headlamp-2000-lumens', 3),
  ('car-interior-led-strip-kit-rgb', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Safety First Bundle
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'safety-first-bundle'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('led-road-flares-emergency-disc-3pack', 0),
  ('tactical-led-flashlight-5000-lumens', 1),
  ('handibeam-led-safety-glasses', 2),
  ('digital-tire-pressure-gauge-backlit', 3),
  ('4k-dual-dash-cam-night-vision-gps', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Tech Enthusiast Collection
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'tech-enthusiast-collection'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('premium-7inch-touchscreen-car-stereo', 0),
  ('4k-dual-dash-cam-night-vision-gps', 1),
  ('obd2-bluetooth-scanner-diagnostic-tool', 2),
  ('wireless-car-charger-mount-auto-clamping', 3),
  ('2-in-1-wireless-carplay-android-auto-adapter-ultra-fast-low-latency', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Interior Makeover
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'interior-makeover'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('premium-leather-seat-covers-full-set', 0),
  ('car-interior-led-strip-kit-rgb', 1),
  ('collapsible-car-trunk-organizer-cooler', 2),
  ('cordless-car-vacuum-cleaner-12000pa', 3)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- Weekend Warrior Kit -- pairs the new woodworking/DIY tools with
-- rugged lighting and power gear, a real fit for both sides of
-- the catalog rather than a copy of another collection.
INSERT INTO product_collection_items (collection_id, product_id, position)
SELECT (SELECT id FROM product_collections WHERE slug = 'weekend-warrior-kit'), p.id, v.pos
FROM products p
JOIN (VALUES
  ('vevor-aluminum-alloy', 0),
  ('portable-wood-door-lock-installation-drill-jig-mortice-kit-6a75ccbb', 1),
  ('faryodi-adjustable-cabinet-hardware-drill-guide-blue-766f22d5', 2),
  ('led-light-bar-mechanic-creeper-36inch', 3),
  ('tactical-led-flashlight-5000-lumens', 4)
) AS v(slug, pos) ON v.slug = p.slug
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- =====================================================
-- 5. POPULATE CATEGORY COLLECTIONS with real categories
--    (additive only -- "Popular Categories" already had one real
--    real link (Interior & Comfort) which is left untouched).
-- =====================================================

-- Popular Categories
INSERT INTO category_collection_items (collection_id, category_id, position)
SELECT (SELECT id FROM category_collections WHERE slug = 'popular-categories'), c.id, v.pos
FROM categories c
JOIN (VALUES
  ('home-improvement-tools', 1),
  ('car-electronics', 2),
  ('safety-security', 3),
  ('lighting', 4)
) AS v(slug, pos) ON v.slug = c.slug
ON CONFLICT (collection_id, category_id) DO NOTHING;

-- New Categories -- the newly expanded "Home Improvement & Tools"
-- top-level category plus its 3 subcategories that actually have
-- real products live in them (migration 055/056).
INSERT INTO category_collection_items (collection_id, category_id, position)
SELECT (SELECT id FROM category_collections WHERE slug = 'new-categories'), c.id, v.pos
FROM categories c
JOIN (VALUES
  ('home-improvement-tools', 0),
  ('woodworking-tools', 1),
  ('measuring-layout-tools', 2),
  ('cabinet-furniture-hardware', 3)
) AS v(slug, pos) ON v.slug = c.slug
ON CONFLICT (collection_id, category_id) DO NOTHING;

-- Featured Categories
INSERT INTO category_collection_items (collection_id, category_id, position)
SELECT (SELECT id FROM category_collections WHERE slug = 'featured-categories'), c.id, v.pos
FROM categories c
JOIN (VALUES
  ('home-improvement-tools', 0),
  ('car-electronics', 1),
  ('safety-security', 2),
  ('performance-parts', 3),
  ('lighting', 4)
) AS v(slug, pos) ON v.slug = c.slug
ON CONFLICT (collection_id, category_id) DO NOTHING;

-- Electronics Hub
INSERT INTO category_collection_items (collection_id, category_id, position)
SELECT (SELECT id FROM category_collections WHERE slug = 'electronics-hub'), c.id, v.pos
FROM categories c
JOIN (VALUES
  ('car-electronics', 0),
  ('audio-entertainment', 1),
  ('phone-gps-mounts', 2)
) AS v(slug, pos) ON v.slug = c.slug
ON CONFLICT (collection_id, category_id) DO NOTHING;

-- Car Accessories Collection
INSERT INTO category_collection_items (collection_id, category_id, position)
SELECT (SELECT id FROM category_collections WHERE slug = 'car-accessories-collection'), c.id, v.pos
FROM categories c
JOIN (VALUES
  ('performance-parts', 0),
  ('exterior-accessories', 1),
  ('interior-comfort', 2),
  ('cleaning-maintenance', 3)
) AS v(slug, pos) ON v.slug = c.slug
ON CONFLICT (collection_id, category_id) DO NOTHING;
