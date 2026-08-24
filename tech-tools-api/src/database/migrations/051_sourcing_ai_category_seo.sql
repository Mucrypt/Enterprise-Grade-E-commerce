-- SOURCING-1 follow-up: the AI rewrite pipeline now also suggests a
-- category match (from the store's real category list, never invented)
-- and SEO meta title/description -- closes a real gap where committed
-- sourced products always had category_id/meta_title/meta_description
-- NULL, since nothing upstream of commitSourcedProduct ever set them.
-- Mirrors the existing rewritten_*/review_* two-tier pattern already
-- used for title/description: rewritten_* is the AI's own suggestion
-- (never edited), review_* is the founder's override (nullable, falls
-- back to rewritten_* at commit time).
ALTER TABLE sourced_products
  ADD COLUMN IF NOT EXISTS rewritten_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rewritten_meta_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rewritten_meta_description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS review_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_meta_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS review_meta_description VARCHAR(500);
