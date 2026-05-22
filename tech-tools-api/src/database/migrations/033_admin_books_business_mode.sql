-- Admin books publishing + business mode activation (additive, backward-compatible)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_business_account BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS business_mode_activated_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS business_mode_source VARCHAR(50);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS admin_origin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS last_uploaded_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_business_mode_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(60) NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_book_idempotency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(60) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  resource_id UUID,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (admin_id, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_users_business_account
  ON users(is_business_account)
  WHERE is_business_account = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_admin_origin
  ON products(admin_origin)
  WHERE admin_origin = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_created_by_admin_id
  ON products(created_by_admin_id)
  WHERE created_by_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_business_mode_audit_user
  ON user_business_mode_audit(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_book_idempotency_lookup
  ON admin_book_idempotency(admin_id, action, idempotency_key);
