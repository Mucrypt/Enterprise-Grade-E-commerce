-- SOURCING-1 follow-up: lets the founder edit captured "Key attributes"
-- before committing, mirroring the review_images/captured_images split
-- (captured_specs stays the untouched original; review_specs is the
-- editable working copy, NULL until the founder actually edits it).
ALTER TABLE sourced_products
  ADD COLUMN IF NOT EXISTS review_specs JSONB;
