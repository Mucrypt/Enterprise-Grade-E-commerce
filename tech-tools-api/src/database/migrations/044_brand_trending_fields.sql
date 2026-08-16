-- =====================================================
-- BRAND TRENDING FIELDS
-- =====================================================
-- Fixes a real, previously-silent bug: the admin Trending page's "Featured"
-- toggle and rank display for brands had nothing to persist to -- the
-- `brands` table has never had an is_featured or ranking column, so
-- PUT /brands/:id { is_featured: true } was silently ignored by
-- updateBrand() (it only ever read name/slug/description/logoUrl/
-- websiteUrl/isActive off the request body), and the "Rank #N" shown on
-- every brand card was just its array index in an alphabetical SELECT *
-- FROM brands ORDER BY name ASC query, not a real, admin-settable value.
--
-- Mirrors the equivalent, already-real columns on product_collections
-- (is_featured BOOLEAN, position INTEGER) added in
-- 003_media_and_collections_schema.sql -- same names, same semantics, so
-- both admin trending tables (collections and brands) work identically.
--
-- Migration number authority: this repository's newest prior migration is
-- 043_promotion_campaigns.sql (see docs/PROMOTION-OPS-1-IMPLEMENTATION-
-- REPORT.md's Production Review Round 1 for how 042/043 were themselves
-- verified). This file assumes 043 remains the latest migration actually
-- recorded in the production schema_migrations table. Verify with:
--   SELECT id, filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 5;
-- before applying -- if a newer migration already exists in production
-- that this repository doesn't have, STOP and renumber this file first.

ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trending_position INTEGER;

COMMENT ON COLUMN brands.is_featured IS 'Real, admin-settable flag -- whether this brand appears in the storefront/mobile "Featured Stores" trending section. Previously this toggle existed in the admin UI but had no column to persist to.';
COMMENT ON COLUMN brands.trending_position IS 'Admin-settable manual sort order for featured brands (lower = shown first), same convention as product_collections.position. NULL means unranked -- falls back to name order.';

CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON brands(is_featured) WHERE is_featured = TRUE;
