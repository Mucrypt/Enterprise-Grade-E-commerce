-- Supplier catalogue bulk-import support + EUR-first defaults + fulfillment routing groundwork.
-- Additive and backward-compatible: existing supplier/product rows and behavior are unaffected.

-- Widen source_platform to cover real wholesale/dropship onboarding (not just marketplace arbitrage).
-- The column itself must widen too: 'wholesale_distributor' is 21 chars, past the original VARCHAR(20).
ALTER TABLE suppliers
ALTER COLUMN source_platform TYPE VARCHAR(30);

DO $$
BEGIN
  ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_source_platform_check;
  ALTER TABLE suppliers
    ADD CONSTRAINT suppliers_source_platform_check
    CHECK (source_platform IN ('amazon', 'alibaba', 'wholesale_distributor', 'brand_manufacturer', 'other'));
END
$$;

-- This is a European business: new supplier offers should default to EUR, not USD.
ALTER TABLE supplier_products
ALTER COLUMN currency_code SET DEFAULT 'EUR';

-- Tracks each CSV catalogue import so staff can preview before committing and audit past imports.
CREATE TABLE IF NOT EXISTS supplier_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'preview',
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  parsed_rows JSONB,
  error_report JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  committed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT supplier_import_batches_status_check
    CHECK (status IN ('preview', 'committed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_import_batches_supplier
  ON supplier_import_batches(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_import_batches_status
  ON supplier_import_batches(status);
