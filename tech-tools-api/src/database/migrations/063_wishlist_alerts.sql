-- =====================================================
-- Wishlist Alert Tracking
-- Version: 063
-- Description: The `wishlist` table has existed since migration 001 but
--              nothing in the real backend has ever read or written it --
--              no /wishlist route was even registered; both frontends'
--              wishlists are 100% local (Zustand + localStorage/
--              AsyncStorage). This migration adds the two columns a
--              back-in-stock/price-drop alert worker needs to detect a
--              REAL transition (not just "is currently in stock/on
--              sale", which would fire every tick forever) -- paired
--              with real wishlist.controller.ts CRUD + sync endpoints
--              and real frontend store syncing shipped alongside this.
-- =====================================================

ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS last_checked_price DECIMAL(10,2);
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS last_checked_in_stock BOOLEAN;

COMMENT ON COLUMN wishlist.last_checked_price IS 'Price observed at the last alert-worker tick -- NULL means never observed yet (no alert fires on first sight, only on a real drop from a known baseline)';
COMMENT ON COLUMN wishlist.last_checked_in_stock IS 'Stock availability observed at the last alert-worker tick -- NULL means never observed yet';
