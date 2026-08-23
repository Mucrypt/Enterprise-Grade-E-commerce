-- SOURCING-1 follow-up: captures the Alibaba/Amazon supplier/manufacturer
-- name at import time so the founder can see and later act on it (e.g.
-- add them as a tracked supplier via the existing Suppliers page) without
-- re-visiting the source listing. Deliberately NOT auto-linked into the
-- curated suppliers table -- that's a manual, deliberate promotion the
-- founder makes, not something a page-scrape should populate automatically.
ALTER TABLE sourced_products
  ADD COLUMN IF NOT EXISTS captured_supplier_name TEXT;
