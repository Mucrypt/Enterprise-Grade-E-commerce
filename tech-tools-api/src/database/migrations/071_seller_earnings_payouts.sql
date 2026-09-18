-- Seller earnings & manual payout ledger.
--
-- seller_tier_config.commission_rate has existed since 034 but was never
-- used for any money calculation -- nothing tracked what a seller earned,
-- and nothing ever paid them. This is that system, mirroring the
-- affiliate program's shape (054_affiliate_referral_program.sql) closely:
--   seller_earnings      ~ affiliate_conversions  (status machine, snapshots)
--   seller_payout_ledger ~ store_credit_ledger     (append-only, no cached balance)
-- New concept the affiliate system didn't need: seller_payout_batches, a
-- real row for "admin manually sent real money," since a seller payout
-- here is a cash event outside the platform (bank transfer, PayPal),
-- not an internal store-credit wallet. No Stripe Connect yet --
-- payout_method/payout_reference/stripe_transfer_id are free-form/
-- nullable so an automated-transfer fast-follow is additive, not a
-- rewrite.
--
-- Earnings are tracked per (order, seller), not per order_item: the only
-- refund/fulfillment signal that exists anywhere in this schema is at
-- the order level (orders.order_status/payment_status) -- order_items.
-- item_status/shipped_at/delivered_at are confirmed dead columns no code
-- path ever writes. A per-item earnings row would imply a refund
-- precision this system cannot actually observe. seller_earning_items
-- still gives line-item audit detail underneath the real (order, seller)
-- status machine.

DO $$ BEGIN
  CREATE TYPE seller_earning_status AS ENUM ('pending', 'confirmed', 'cancelled', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Singleton settings row, same shape as affiliate_settings.
CREATE TABLE IF NOT EXISTS seller_payout_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- Used only when an order never reaches 'delivered' (same rationale as
  -- affiliate_settings.fallback_hold_period_days -- orders frequently
  -- never reach 'delivered' in practice).
  fallback_hold_period_days INTEGER NOT NULL DEFAULT 30,
  -- Reserved, informational only in v1 -- payouts are a manual admin
  -- action with no enforced minimum yet. Exists so a future automated
  -- threshold rule doesn't need another migration.
  min_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Kill switch: false stops new earning recording without a deploy.
  program_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (id = 1)
);
INSERT INTO seller_payout_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Per-tier hold period -- the seed descriptions in 034 already promised
-- "14-day"/"7-day" payout holds by tier ("Platform holds payouts for 14
-- days" / "7-day payout hold"); this is the first real column backing
-- that text, rewarding trust the way the original seed data implied it
-- should.
ALTER TABLE seller_tier_config ADD COLUMN IF NOT EXISTS payout_hold_period_days INTEGER;
UPDATE seller_tier_config SET payout_hold_period_days = CASE tier
  WHEN 'unverified' THEN 14
  WHEN 'basic'      THEN 7
  WHEN 'trusted'    THEN 3
  WHEN 'pro'        THEN 0
END WHERE payout_hold_period_days IS NULL;
ALTER TABLE seller_tier_config ALTER COLUMN payout_hold_period_days SET NOT NULL;

-- One row per real-world "admin sent money" event.
CREATE TABLE IF NOT EXISTS seller_payout_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  -- Nullable/free-form on purpose -- no Stripe Connect yet, this just
  -- records however the admin actually paid (bank transfer, PayPal, etc.).
  payout_method VARCHAR(30),
  payout_reference VARCHAR(255),
  notes TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_by_admin_id UUID NOT NULL REFERENCES users(id),
  -- Reserved for a future Connect fast-follow (an automated transfer
  -- that could fail asynchronously) -- v1 only ever inserts 'sent',
  -- since a manual admin action is definitionally already-sent.
  payout_status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (payout_status = 'sent'),
  stripe_transfer_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_seller_payout_batches_seller ON seller_payout_batches(seller_profile_id, sent_at DESC);

-- One row per (order, seller) -- see migration header for why this
-- granularity, not per order_item.
CREATE TABLE IF NOT EXISTS seller_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Sum of this seller's order_items.total_price in this order --
  -- pre-tax/shipping, same "never pay commission on tax/shipping"
  -- principle as affiliate_conversions.order_value.
  gross_item_amount DECIMAL(10,2) NOT NULL,
  seller_tier_snapshot seller_tier NOT NULL,
  commission_rate_snapshot NUMERIC(5,2) NOT NULL,
  platform_commission_amount DECIMAL(10,2) NOT NULL,
  seller_net_amount DECIMAL(10,2) NOT NULL,
  status seller_earning_status NOT NULL DEFAULT 'pending',
  cancelled_reason VARCHAR(100),
  -- Set only once status='paid' AND that batch is later refunded --
  -- status intentionally stays 'paid' (preserves the historical fact
  -- "this was part of payout batch X"); this timestamp plus a new
  -- negative ledger row is the only signal a clawback-after-payout ever
  -- happened.
  clawed_back_at TIMESTAMPTZ,
  payout_batch_id UUID REFERENCES seller_payout_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  UNIQUE(order_id, seller_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_seller ON seller_earnings(seller_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_pending ON seller_earnings(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_seller_earnings_confirmed ON seller_earnings(status) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_seller_earnings_payout_batch ON seller_earnings(payout_batch_id) WHERE payout_batch_id IS NOT NULL;

-- Line-item audit detail underneath a seller_earnings row -- satisfies
-- per-item traceability without using item-level granularity for the
-- status machine (see migration header).
CREATE TABLE IF NOT EXISTS seller_earning_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_earning_id UUID NOT NULL REFERENCES seller_earnings(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  item_gross_amount DECIMAL(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seller_earning_items_earning ON seller_earning_items(seller_earning_id);

-- Append-only ledger -- store_credit_ledger's shape exactly, no cached
-- balance column. A seller's live "owed, unpaid" balance is always
-- SUM(delta_amount) for that seller_profile_id, computed on read.
CREATE TABLE IF NOT EXISTS seller_payout_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  delta_amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(30) NOT NULL CHECK (reason IN (
    'earning_confirmed', 'earning_clawback', 'payout_sent'
  )),
  reference_type VARCHAR(30),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_seller_payout_ledger_seller ON seller_payout_ledger(seller_profile_id, created_at);
