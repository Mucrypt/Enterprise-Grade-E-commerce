-- Affiliate / referral program.
--
-- Any signed-in customer gets an instant referral code (no application
-- step) and earns a flat, admin-configurable % of the orders they refer,
-- credited as store credit once an order is safely past return/refund
-- risk. Attribution is cookie-based, last-click, 30-day window (the cookie
-- itself lives in the storefront, not here).
--
-- Deliberately separate from the coupon system (006_coupons_and_reviews.sql)
-- even though the shapes rhyme (coupon_usage ~= affiliate_conversions) --
-- coupons are merchant-authored discount codes; this is a per-customer
-- earn/reward system with its own fraud surface (self-referral) and its
-- own payout mechanism (store credit), so keeping them as separate tables
-- keeps both simpler than one shared "codes" abstraction would be.

DO $$ BEGIN
    CREATE TYPE affiliate_profile_status AS ENUM ('active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- 'paid' is reserved/dormant: nothing in this migration's application
    -- code ever writes it. It exists so a future cash-payout (PayPal)
    -- fast-follow doesn't need another migration just to add a status.
    CREATE TYPE affiliate_conversion_status AS ENUM ('pending', 'confirmed', 'cancelled', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Singleton settings row, same shape as shipping_settings (005_shipping.sql).
CREATE TABLE IF NOT EXISTS affiliate_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    commission_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    hold_period_days INTEGER NOT NULL DEFAULT 14,
    fallback_hold_period_days INTEGER NOT NULL DEFAULT 30,
    -- Reserved for a future cash-payout minimum; unused by the v1
    -- store-credit-only flow (store credit has no minimum redemption).
    min_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    -- Kill switch: false stops new click capture/attribution without a deploy.
    program_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (id = 1)
);
INSERT INTO affiliate_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- One profile per user, auto-created on first /refer visit.
CREATE TABLE IF NOT EXISTS affiliate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status affiliate_profile_status NOT NULL DEFAULT 'active',
    -- Rollup columns, kept in sync by triggers below -- informational only.
    -- store_credit_ledger is the source of truth for actual balance.
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    total_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_affiliate_profiles_referral_code ON affiliate_profiles(referral_code);

-- Raw click log. Deliberately no IP/user-agent columns -- click count is a
-- growth/vanity metric here, not a security log, so we collect the
-- minimum. visitor_id is a random, non-account-linked cookie value, used
-- only to let stats queries de-dupe obviously repeated clicks.
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    visitor_id VARCHAR(64),
    landing_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id, created_at);

-- One row per order that had a valid, non-self-referral attributed to it.
-- order_id UNIQUE gives idempotency against Stripe webhook retries, on top
-- of the existing stripe_webhook_events unique-event-id gate.
CREATE TABLE IF NOT EXISTS affiliate_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    -- Snapshot of orders.total_amount (pre-tax/shipping subtotal) at the
    -- moment payment succeeded -- commission is never paid on tax/shipping.
    order_value DECIMAL(10,2) NOT NULL,
    -- affiliate_settings.commission_rate_percent at that same moment --
    -- later rate changes never retroactively affect an existing row.
    commission_rate_snapshot DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    status affiliate_conversion_status NOT NULL DEFAULT 'pending',
    cancelled_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate_id ON affiliate_conversions(affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_pending ON affiliate_conversions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_confirmed ON affiliate_conversions(status) WHERE status = 'confirmed';

-- Append-only store-credit ledger -- the first wallet-like system in this
-- codebase. Deliberately no cached balance column: balance is always
-- SUM(delta_amount) for a user, computed live. At this catalog/order scale
-- a live indexed SUM is cheap, and it avoids an entire class of "rollup
-- drifted from reality" bugs that a cached-balance-plus-ledger design
-- would risk on its first implementation.
CREATE TABLE IF NOT EXISTS store_credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Positive = credited (commission earned), negative = redeemed at
    -- checkout or clawed back after a late refund.
    delta_amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'affiliate_commission', 'affiliate_commission_clawback',
        'redeemed_at_checkout', 'manual_adjustment'
    )),
    reference_type VARCHAR(30),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_credit_ledger_user_id ON store_credit_ledger(user_id, created_at);

-- How much of an order's grand_total was paid via store credit. The
-- order's own total_amount/tax_amount/grand_total stay the real,
-- undiscounted values (needed for refund math and commission calc) --
-- only the actual Stripe charge amount is reduced by this.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_credit_applied DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Rollup triggers, same shape as update_coupon_usage_count() (006_coupons_and_reviews.sql).
CREATE OR REPLACE FUNCTION update_affiliate_click_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE affiliate_profiles
    SET total_clicks = total_clicks + 1,
        updated_at = NOW()
    WHERE id = NEW.affiliate_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_affiliate_click_count ON affiliate_clicks;
CREATE TRIGGER trigger_update_affiliate_click_count
    AFTER INSERT ON affiliate_clicks
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_click_count();

CREATE OR REPLACE FUNCTION update_affiliate_conversion_rollup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
        UPDATE affiliate_profiles
        SET total_conversions = total_conversions + 1,
            total_earned = total_earned + NEW.commission_amount,
            updated_at = NOW()
        WHERE id = NEW.affiliate_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_affiliate_conversion_rollup ON affiliate_conversions;
CREATE TRIGGER trigger_update_affiliate_conversion_rollup
    AFTER INSERT OR UPDATE ON affiliate_conversions
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_conversion_rollup();
