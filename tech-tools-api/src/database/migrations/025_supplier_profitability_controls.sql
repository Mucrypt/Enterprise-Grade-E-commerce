-- Phase P0: Supplier intelligence + profitability controls
-- Migration: 025_supplier_profitability_controls.sql

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS source_platform VARCHAR(20) CHECK (source_platform IN ('amazon', 'alibaba', 'other')) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) CHECK (status IN ('active', 'watchlist', 'blocked')) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rating DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS defect_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS refund_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_source_platform ON suppliers(source_platform) WHERE deleted_at IS NULL;

ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS currency_code CHAR(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER,
  ADD COLUMN IF NOT EXISTS supplier_url TEXT;

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);

CREATE TABLE IF NOT EXISTS product_unit_economics (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  landed_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ad_cost_per_order DECIMAL(12,2) NOT NULL DEFAULT 0,
  expected_refund_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
  contribution_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
  margin_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_operational_flags (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  auto_pause BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT,
  is_publish_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  publish_block_reason TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO product_operational_flags (product_id)
SELECT p.id
FROM products p
ON CONFLICT (product_id) DO NOTHING;
