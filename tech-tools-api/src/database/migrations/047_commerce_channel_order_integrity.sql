-- =====================================================
-- COMMERCE CHANNEL ORDER INTEGRITY (TIKTOK-COMMERCE-1-PRODUCTION-REVIEW-1)
-- =====================================================
-- Additive-only hardening for the order-import path built in
-- 046_commerce_channel_sync.sql. Three changes:
--   1. channel_orders.external_updated_at -- lets importOrders() detect and
--      ignore an out-of-order/stale remote event instead of blindly
--      overwriting a newer known status with an older one.
--   2. commerce_channel_accounts.order_import_watermark -- a persisted
--      checkpoint so polling doesn't re-download the same rolling window
--      forever; only advanced after a fully-successful (no partial
--      pagination failure) import run.
--   3. channel_order_import_issues -- a durable reconciliation record for a
--      remote order that could not be safely normalized into a
--      channel_orders row (unparseable amount, missing currency, malformed
--      payload). A real TikTok order must never disappear silently -- see
--      docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md's Production Review
--      Round 1 section.
--
-- Migration number authority: assumes 046_commerce_channel_sync.sql is the
-- immediately-preceding migration. Re-verify against the real
-- schema_migrations table before applying -- do not assume.

ALTER TABLE channel_orders
    ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN channel_orders.external_updated_at IS 'The remote channel''s own last-modified timestamp for this order, if the API supplies one (TikTok Shop order search/detail reportedly includes update_time -- unverified against a primary source, see tiktok-shop.types.ts). NULL means the channel did not report one for this order; in that case every import is applied (no ordering signal available, documented limitation) rather than guessed at.';

ALTER TABLE commerce_channel_accounts
    ADD COLUMN IF NOT EXISTS order_import_watermark TIMESTAMPTZ;

COMMENT ON COLUMN commerce_channel_accounts.order_import_watermark IS 'Checkpoint for the order-import poller -- the start time of the last FULLY successful (no partial-pagination-failure) import run. A poll fetches from (watermark - overlap buffer) rather than re-downloading a fixed rolling window every time. Never advanced after a partial/failed run, so a page that failed to fetch is retried on the next poll rather than silently skipped.';

-- =====================================================
-- CHANNEL ORDER IMPORT ISSUES
-- =====================================================
-- A remote order that genuinely cannot become a valid channel_orders row
-- (channel_orders.gross_amount/currency are NOT NULL, and a guessed value
-- would misrepresent a real sale -- see channel-sync.service.ts's
-- importOrders()). Recorded here instead of silently skipped, so the
-- founder/ops team can see and act on it without reading server logs.
--
-- Deliberately minimal PII: no buyer name/address/phone/email columns --
-- only what's needed to locate the order on TikTok's own side and diagnose
-- the failure (external_order_id, reason, a short detail string). Full
-- buyer data is never duplicated into this table.
CREATE TABLE IF NOT EXISTS channel_order_import_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    sync_run_id UUID REFERENCES channel_sync_runs(id) ON DELETE SET NULL,
    external_order_id TEXT NOT NULL,
    external_updated_at TIMESTAMPTZ,
    -- UNMAPPED_PRODUCT/MISSING_REQUIRED_SKU are schema-ready (kept for
    -- forward compatibility with the founder's own example list) but are
    -- not emitted by any code this round ships -- an unmapped-SKU order
    -- line is still imported normally (never blocked), only flagged for
    -- mapping via a derived query against channel_order_items, not routed
    -- through this order-level "could not import at all" table. See
    -- docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md's Production Review
    -- Round 1 section for the reasoning.
    reason_code TEXT NOT NULL CHECK (reason_code IN (
        'INVALID_ORDER_AMOUNT',
        'MISSING_CURRENCY',
        'MISSING_REQUIRED_SKU',
        'UNMAPPED_PRODUCT',
        'UNSUPPORTED_ORDER_STATE',
        'MALFORMED_REMOTE_ORDER'
    )),
    reason_detail TEXT,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one OPEN (unresolved) issue per remote order -- re-detecting the
-- same broken order on a later poll updates the existing open row in place
-- (upsert) rather than accumulating duplicate rows for one ongoing
-- problem. A resolved issue that recurs later opens a fresh row, so
-- history of prior resolutions is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_order_import_issues_open
    ON channel_order_import_issues(channel_account_id, external_order_id)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_channel_order_import_issues_account_open
    ON channel_order_import_issues(channel_account_id)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_order_import_issues_run_id ON channel_order_import_issues(sync_run_id);

COMMENT ON TABLE channel_order_import_issues IS 'Durable reconciliation record for a remote order that could not be safely normalized into channel_orders. A real TikTok order must never disappear silently -- this table is the "2 TikTok orders require reconciliation" queue the Operations dashboard surfaces.';
