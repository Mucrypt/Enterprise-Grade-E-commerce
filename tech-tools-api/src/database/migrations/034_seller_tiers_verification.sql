-- Tiered Seller Verification System
-- Additive migration - backward compatible, no destructive changes
-- Progressive trust model: low friction at Tier 0, verified at higher tiers

-- Seller tier type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_tier') THEN
    CREATE TYPE seller_tier AS ENUM ('unverified', 'basic', 'trusted', 'pro');
  END IF;
END
$$;

-- Seller verification status type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_verification_status') THEN
    CREATE TYPE seller_verification_status AS ENUM ('none', 'pending', 'approved', 'rejected', 'suspended');
  END IF;
END
$$;

-- Core seller profiles table
CREATE TABLE IF NOT EXISTS seller_profiles (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Identity
  display_name             VARCHAR(140),
  handle                   VARCHAR(80) UNIQUE,
  bio                      TEXT,
  avatar_url               TEXT,
  banner_url               TEXT,

  -- Trust tier (starts at unverified, progresses via verification)
  tier                     seller_tier NOT NULL DEFAULT 'unverified',
  verification_status      seller_verification_status NOT NULL DEFAULT 'none',

  -- Tier-gated limits (enforced server-side per tier config)
  max_active_listings      INTEGER NOT NULL DEFAULT 5,
  max_product_price        NUMERIC(12, 2) DEFAULT 99.99,

  -- Performance metrics (updated by order system)
  total_sales              INTEGER NOT NULL DEFAULT 0,
  total_revenue            NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  average_rating           NUMERIC(3, 2),
  review_count             INTEGER NOT NULL DEFAULT 0,
  dispute_count            INTEGER NOT NULL DEFAULT 0,
  dispute_win_count        INTEGER NOT NULL DEFAULT 0,

  -- Verification checkpoints
  phone_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  id_verified              BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted           BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at        TIMESTAMPTZ,

  -- Approval metadata
  verified_at              TIMESTAMPTZ,
  verified_by_admin_id     UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  is_suspended             BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason        TEXT,
  suspended_at             TIMESTAMPTZ,
  suspended_by_admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Flexible metadata (payout info ref, tax ref, etc.)
  metadata                 JSONB,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Verification requests table (paper trail for each tier upgrade request)
CREATE TABLE IF NOT EXISTS seller_verification_requests (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_profile_id        UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,

  requested_tier           seller_tier NOT NULL,
  status                   seller_verification_status NOT NULL DEFAULT 'pending',

  -- What the seller submitted (document references, not raw files)
  documents_submitted      JSONB,   -- [{type: 'phone', verifiedAt}, {type: 'id', referenceId, submittedAt}]
  notes                    TEXT,    -- seller's own note

  -- Admin review
  reviewed_by_admin_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at              TIMESTAMPTZ,
  admin_notes              TEXT,
  admin_decision_reason    TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutable audit log for all seller state changes
CREATE TABLE IF NOT EXISTS seller_audit_log (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id        UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES users(id),
  actor_id                 UUID REFERENCES users(id),  -- admin or system that acted
  action                   VARCHAR(80) NOT NULL,
  previous_state           JSONB,
  new_state                JSONB,
  details                  JSONB,
  ip_address               INET,
  user_agent               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Static tier config: platform-wide limits and commission per tier
CREATE TABLE IF NOT EXISTS seller_tier_config (
  tier                         seller_tier PRIMARY KEY,
  max_active_listings          INTEGER NOT NULL,
  max_product_price            NUMERIC(12, 2),          -- NULL = unlimited
  commission_rate              NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
  requires_phone_verification  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_id_verification     BOOLEAN NOT NULL DEFAULT FALSE,
  requires_payment_method      BOOLEAN NOT NULL DEFAULT FALSE,
  requires_admin_approval      BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_protection_level       VARCHAR(30) NOT NULL DEFAULT 'standard',  -- standard | enhanced | premium
  description                  TEXT
);

-- Seed tier config (safe, idempotent)
INSERT INTO seller_tier_config
  (tier, max_active_listings, max_product_price, commission_rate,
   requires_phone_verification, requires_id_verification,
   requires_payment_method, requires_admin_approval,
   buyer_protection_level, description)
VALUES
  ('unverified', 5,    99.99,  20.00, FALSE, FALSE, FALSE, FALSE, 'standard',
   'New seller — instant access, up to 5 listings, items under $100. Platform holds payouts for 14 days.'),
  ('basic',      25,   499.99, 15.00, TRUE,  FALSE, TRUE,  FALSE, 'standard',
   'Basic verified — phone + payment method confirmed, up to 25 listings. 7-day payout hold.'),
  ('trusted',    100,  2499.99,12.00, TRUE,  TRUE,  TRUE,  TRUE,  'enhanced',
   'Trusted seller — full ID verification and admin approval. Up to 100 listings, enhanced buyer protection.'),
  ('pro',        99999, NULL,  10.00, TRUE,  TRUE,  TRUE,  TRUE,  'premium',
   'Pro seller — proven track record, unlimited listings, premium buyer protection, priority support.')
ON CONFLICT (tier) DO NOTHING;

-- Link products to seller profiles (additive column)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id
  ON seller_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_tier
  ON seller_profiles(tier);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_active_tier
  ON seller_profiles(is_active, tier)
  WHERE is_active = TRUE AND is_suspended = FALSE;

CREATE INDEX IF NOT EXISTS idx_seller_verification_requests_user
  ON seller_verification_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_verification_requests_pending
  ON seller_verification_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_seller_audit_log_profile
  ON seller_audit_log(seller_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_seller_profile_id
  ON products(seller_profile_id)
  WHERE seller_profile_id IS NOT NULL;
