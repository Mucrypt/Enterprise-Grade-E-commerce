-- Phase 1 foundation for Books + Web3 rollout.
-- This migration is additive and backward-compatible with existing product flows.

-- Product kind supports progressive expansion without changing existing product behavior.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_kind VARCHAR(30);

UPDATE products
SET product_kind = CASE WHEN is_digital = true THEN 'digital' ELSE 'physical' END
WHERE product_kind IS NULL;

ALTER TABLE products
ALTER COLUMN product_kind SET DEFAULT 'physical';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_kind_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_product_kind_check
    CHECK (product_kind IN ('physical', 'digital', 'book', 'service'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  website_url VARCHAR(500),
  social_links JSONB DEFAULT '{}'::jsonb,
  payout_address VARCHAR(255),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT creator_profiles_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS creator_profile_id UUID REFERENCES creator_profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS book_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  format VARCHAR(30) NOT NULL DEFAULT 'pdf',
  file_url VARCHAR(500),
  preview_url VARCHAR(500),
  cover_image_url VARCHAR(500),
  language_code VARCHAR(10) DEFAULT 'en',
  page_count INTEGER,
  isbn VARCHAR(32),
  publisher_name VARCHAR(255),
  publication_date DATE,
  drm_enabled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS web3_book_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  chain_id INTEGER,
  contract_address VARCHAR(255),
  token_standard VARCHAR(20),
  token_id VARCHAR(255),
  royalty_bps INTEGER DEFAULT 0,
  metadata_uri VARCHAR(1000),
  minted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT web3_book_assets_royalty_bps_check
    CHECK (royalty_bps >= 0 AND royalty_bps <= 10000)
);

CREATE INDEX IF NOT EXISTS idx_products_product_kind
  ON products(product_kind)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_creator_profile
  ON products(creator_profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_handle
  ON creator_profiles(handle);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id
  ON creator_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_book_metadata_product_id
  ON book_metadata(product_id);

CREATE INDEX IF NOT EXISTS idx_web3_book_assets_product_id
  ON web3_book_assets(product_id);