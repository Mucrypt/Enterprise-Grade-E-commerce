-- Phase 1 Week 1: digital library foundation.
-- Additive migration for assets, entitlements, and reading progress.

CREATE TABLE IF NOT EXISTS digital_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_type VARCHAR(20) NOT NULL DEFAULT 'full',
  storage_url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT,
  checksum VARCHAR(255),
  watermark_template VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT digital_assets_asset_type_check
    CHECK (asset_type IN ('full', 'sample', 'cover', 'audio'))
);

CREATE TABLE IF NOT EXISTS digital_entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  license_type VARCHAR(30) NOT NULL DEFAULT 'standard',
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  device_limit INTEGER NOT NULL DEFAULT 3,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT digital_entitlements_device_limit_check
    CHECK (device_limit > 0)
);

CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_ref TEXT,
  percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reading_progress_percent_check
    CHECK (percent_complete >= 0 AND percent_complete <= 100)
);

CREATE INDEX IF NOT EXISTS idx_digital_assets_product_type_active
  ON digital_assets(product_id, asset_type, is_active);

CREATE INDEX IF NOT EXISTS idx_digital_entitlements_user_active
  ON digital_entitlements(user_id, product_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_digital_entitlements_order
  ON digital_entitlements(order_id, order_item_id);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user_updated
  ON reading_progress(user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_progress_user_product_unique
  ON reading_progress(user_id, product_id);