-- =====================================================
-- COMMERCE CHANNEL SYNC DOMAIN (TIKTOK-COMMERCE-1)
-- =====================================================
-- Product/order/inventory/finance sync domain, with a clean forward FK to
-- 045_commerce_channel_foundation.sql's commerce_channel_accounts. Ends
-- with one trailing ALTER TABLE giving channel_activity_log.sync_run_id
-- its FK to channel_sync_runs -- the one deliberate forward-reference
-- patch, since 045 predates the table it eventually points to (same
-- pattern 043_promotion_campaigns.sql used for 042's ledger tables).
--
-- Migration number authority: assumes 045_commerce_channel_foundation.sql
-- is the immediately-preceding migration and that 044 remained the latest
-- migration actually recorded in the production schema_migrations table
-- when 045 was authored. Re-verify both assumptions against the real
-- schema_migrations table before applying either file.

CREATE TYPE channel_product_mapping_status AS ENUM (
    'UNMAPPED',
    'MAPPED',
    'CONFLICT',
    'CHANNEL_ONLY'
);

CREATE TYPE channel_inventory_diff_action AS ENUM (
    'NONE',
    'FLAGGED',
    'WRITTEN_TO_CHANNEL'
);

CREATE TYPE channel_financial_transaction_type AS ENUM (
    'SETTLEMENT',
    'COMMISSION',
    'AD_SPEND',
    'REFUND',
    'AFFILIATE_COMMISSION'
);

-- =====================================================
-- CHANNEL PRODUCT MAPPINGS
-- =====================================================
-- TechTools product <-> channel listing link. channel_sku lives directly
-- on this row rather than in a separate channel_sku_mappings table -- a
-- TikTok Shop SKU is a property of one specific listing, and
-- product_variations (the natural place a real SKU-level entity would
-- live) is schema-ready but not fully wired yet (createProduct never
-- inserts into it). Splitting SKU into its own table now would be
-- speculative normalization for a variant system that doesn't exist in
-- this codebase yet; channel_variation_id is reserved for when it does.
CREATE TABLE IF NOT EXISTS channel_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    -- SET NULL, not CASCADE: deleting a TechTools product must never
    -- silently delete channel sync history -- same rationale as
    -- promotion_campaign_products.product_id.
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    channel_product_id TEXT NOT NULL,
    channel_sku TEXT,
    -- Reserved for once product_variations is genuinely live -- never
    -- populated by any code this phase ships.
    channel_variation_id TEXT,
    -- CHANNEL_ONLY = a real TikTok listing with no matching TechTools
    -- product -- surfaced to the ops dashboard, never silently dropped.
    mapping_status channel_product_mapping_status NOT NULL DEFAULT 'UNMAPPED',
    last_synced_at TIMESTAMPTZ,
    -- Structured price/stock/title diff from the last read-only sync pass,
    -- surfaced as-is to the Product Mappings admin page.
    last_diff JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_mappings_identity
    ON channel_product_mappings(channel_account_id, channel_product_id, channel_sku);
CREATE INDEX IF NOT EXISTS idx_channel_product_mappings_product_id ON channel_product_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_product_mappings_status ON channel_product_mappings(mapping_status);

COMMENT ON TABLE channel_product_mappings IS 'TechTools product <-> external channel listing/SKU link, with the last observed read-only diff. Phase 1 never writes back to the channel from this table.';

-- =====================================================
-- CHANNEL ORDERS / CHANNEL ORDER ITEMS
-- =====================================================
-- A channel-side order record, imported read-only for visibility and
-- reconciliation. techtools_order_id is deliberately nullable and
-- unpopulated this phase -- materializing a real orders row per TikTok
-- sale requires deciding checkout/reservation/fulfilment semantics for a
-- channel-originated order, which is not invented speculatively here (see
-- docs/TIKTOK-COMMERCE-1-IMPLEMENTATION-REPORT.md's deferrals). This keeps
-- Phase 1 strictly additive to the existing orders/inventory systems.
CREATE TABLE IF NOT EXISTS channel_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    techtools_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    channel_order_id TEXT NOT NULL,
    -- Raw TikTok status string, stored as-is -- never coerced into
    -- orders.order_status, since the two are different state machines and
    -- forcing a mapping would misrepresent one system as the other.
    channel_order_status TEXT NOT NULL,
    buyer_display_name TEXT,
    buyer_country TEXT,
    currency TEXT NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL,
    -- Nullable, not zero-filled: NULL means the Order/Finance API did not
    -- supply this figure yet, distinct from a confirmed-zero fee. Never
    -- estimated -- see the founder's explicit "no fabricated settlement
    -- fees" instruction.
    platform_commission_amount NUMERIC(12,2),
    shipping_fee_amount NUMERIC(12,2),
    tax_amount NUMERIC(12,2),
    net_amount NUMERIC(12,2),
    -- Full payload retained verbatim for audit/replay -- never discarded,
    -- since the normalized columns above are necessarily a lossy subset.
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_orders_identity
    ON channel_orders(channel_account_id, channel_order_id);
CREATE INDEX IF NOT EXISTS idx_channel_orders_status ON channel_orders(channel_order_status);
CREATE INDEX IF NOT EXISTS idx_channel_orders_imported_at ON channel_orders(imported_at DESC);

COMMENT ON TABLE channel_orders IS 'Read-only import of external-channel orders (TikTok Shop today) for visibility/reconciliation. Does NOT materialize a row in the canonical orders table this phase -- techtools_order_id stays NULL until a future phase deliberately designs that path.';

CREATE TABLE IF NOT EXISTS channel_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_order_id UUID NOT NULL REFERENCES channel_orders(id) ON DELETE CASCADE,
    -- Nullable: a line item with no known product mapping is still
    -- imported (never dropped or guess-matched) and flagged for the ops
    -- dashboard.
    channel_product_mapping_id UUID REFERENCES channel_product_mappings(id) ON DELETE SET NULL,
    channel_sku TEXT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_order_items_order_id ON channel_order_items(channel_order_id);
CREATE INDEX IF NOT EXISTS idx_channel_order_items_mapping_id ON channel_order_items(channel_product_mapping_id);

COMMENT ON TABLE channel_order_items IS 'Line items for an imported channel order. A NULL channel_product_mapping_id means an unmapped listing sold -- surfaced as an operational alert, never silently dropped.';

-- =====================================================
-- CHANNEL SYNC RUNS
-- =====================================================
-- Generalized clone of supplier_import_batches
-- (036_supplier_catalogue_import.sql) -- same preview -> committed/failed
-- lifecycle and status vocabulary, generalized across product-sync,
-- order-import, and inventory-diff via run_type rather than three
-- near-duplicate tables.
CREATE TABLE IF NOT EXISTS channel_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    run_type TEXT NOT NULL CHECK (run_type IN ('PRODUCT_SYNC', 'ORDER_IMPORT', 'INVENTORY_DIFF', 'FINANCE_SYNC')),
    status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview', 'committed', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    unmapped_count INTEGER NOT NULL DEFAULT 0,
    -- The preview payload (per-item planned changes) for a run still in
    -- 'preview' status -- same role as supplier_import_batches.parsed_rows.
    -- Read and applied by the commit step, then left in place afterward as
    -- a historical record of exactly what a committed run changed.
    parsed_items JSONB,
    error_report JSONB,
    -- NULL = an automated/scheduled run, matching
    -- promotion_activity_log.actor_user_id's NULL-for-system convention.
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    committed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_channel_sync_runs_account_id ON channel_sync_runs(channel_account_id);
CREATE INDEX IF NOT EXISTS idx_channel_sync_runs_type_status ON channel_sync_runs(run_type, status);
CREATE INDEX IF NOT EXISTS idx_channel_sync_runs_started_at ON channel_sync_runs(started_at DESC);

COMMENT ON TABLE channel_sync_runs IS 'Preview/commit audit record for every product-sync, order-import, inventory-diff, or finance-sync batch. Modeled directly on supplier_import_batches.';

-- =====================================================
-- CHANNEL INVENTORY DIFFS
-- =====================================================
-- Per-SKU stock comparison detail for an INVENTORY_DIFF sync run. Phase 1
-- code only ever produces NONE/FLAGGED -- WRITTEN_TO_CHANNEL is
-- schema-ready for a future write-enabled phase but is unreachable by any
-- code shipped in this phase (inventory.current_stock is never written to
-- by anything here; see the implementation report's explicit gap note).
CREATE TABLE IF NOT EXISTS channel_inventory_diffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES channel_sync_runs(id) ON DELETE CASCADE,
    channel_product_mapping_id UUID NOT NULL REFERENCES channel_product_mappings(id) ON DELETE CASCADE,
    techtools_available_stock INTEGER,
    channel_reported_stock INTEGER,
    delta INTEGER,
    action_taken channel_inventory_diff_action NOT NULL DEFAULT 'NONE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_inventory_diffs_run_id ON channel_inventory_diffs(run_id);
CREATE INDEX IF NOT EXISTS idx_channel_inventory_diffs_mapping_id ON channel_inventory_diffs(channel_product_mapping_id);

COMMENT ON TABLE channel_inventory_diffs IS 'Per-SKU TechTools-vs-channel stock comparison from a read-only inventory diff run. Phase 1 never writes to inventory.current_stock/reserved_stock or to the external channel -- action_taken is always NONE or FLAGGED.';

-- =====================================================
-- CHANNEL FINANCIAL TRANSACTIONS
-- =====================================================
-- Schema only this phase -- populated by a Finance/Affiliate sync step
-- that ships later in TIKTOK-COMMERCE-1, and only once real API access
-- has been verified to supply genuine figures. Never seeded with
-- estimated/placeholder settlement data.
CREATE TABLE IF NOT EXISTS channel_financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_account_id UUID NOT NULL REFERENCES commerce_channel_accounts(id) ON DELETE CASCADE,
    channel_order_id UUID REFERENCES channel_orders(id) ON DELETE SET NULL,
    transaction_type channel_financial_transaction_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL,
    channel_transaction_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ,
    raw_payload JSONB NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_financial_transactions_identity
    ON channel_financial_transactions(channel_account_id, channel_transaction_id);
CREATE INDEX IF NOT EXISTS idx_channel_financial_transactions_order_id ON channel_financial_transactions(channel_order_id);
CREATE INDEX IF NOT EXISTS idx_channel_financial_transactions_type ON channel_financial_transactions(transaction_type);

COMMENT ON TABLE channel_financial_transactions IS 'Real settlement/commission/ad-spend/refund/affiliate-commission records from the channel Finance API. Schema-only in TIKTOK-COMMERCE-1''s first build steps -- populated only once real API access is verified, never with estimated figures.';

-- =====================================================
-- Forward FK patch-up: 045_commerce_channel_foundation.sql's
-- channel_activity_log.sync_run_id references channel_sync_runs, which
-- only exists as of this file.
-- =====================================================
ALTER TABLE channel_activity_log
    ADD CONSTRAINT fk_channel_activity_log_sync_run
    FOREIGN KEY (sync_run_id) REFERENCES channel_sync_runs(id) ON DELETE SET NULL;
