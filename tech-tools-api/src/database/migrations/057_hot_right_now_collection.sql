-- ============================================================
-- Migration 057: "Hot Right Now" promo collection
-- ============================================================
-- Powers the new global promo drawer (storefront) -- a dedicated,
-- admin-curated product_collection separate from the homepage's
-- is_featured rows (Best Sellers, New Arrivals) so the founder can
-- point ad traffic at a specific, hand-picked set of products without
-- it duplicating what's already shown on the homepage. Deliberately
-- created empty: the admin adds/removes products via the existing
-- Collections admin page (Products > Collections), exactly like every
-- other collection. The drawer renders nothing until this collection
-- is active with at least one real product in it.
-- ============================================================

INSERT INTO product_collections (
  name, slug, description, short_description,
  is_active, is_featured, visibility, position, display_order
) VALUES (
  'Hot Right Now',
  'hot-right-now',
  'Products the team is actively promoting right now.',
  'Hand-picked hot picks, updated as we run promotions.',
  true,
  false,
  'public',
  99,
  'manual'
)
ON CONFLICT (slug) DO NOTHING;
