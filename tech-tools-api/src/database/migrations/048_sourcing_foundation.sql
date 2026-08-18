-- =====================================================
-- SOURCING FOUNDATION (SOURCING-1)
-- =====================================================
-- In-house Alibaba/Amazon product importer -- an AutoDS replacement, since
-- AutoDS does not support Alibaba as a supplier and its API is gated
-- behind a ~$5,000 one-time activation fee with no confirmed support for
-- a custom backend. Product data is captured by a browser extension
-- reading an already-rendered page in the founder's own logged-in
-- session -- this backend never fetches alibaba.com/amazon.* URLs itself.
--
-- Three tables, additive-only, modeled on the preview->commit staging
-- pattern already used twice in this codebase (036_supplier_catalogue_
-- import.sql's supplier_import_batches, 046_commerce_channel_sync.sql's
-- channel_sync_runs).
--
-- Migration number authority: assumes 047_commerce_channel_order_
-- integrity.sql is the immediately-preceding migration. Re-verify against
-- the real schema_migrations table before applying -- do not assume.

-- =====================================================
-- SOURCING API TOKENS
-- =====================================================
-- Long-lived, revocable credential for the browser extension to
-- authenticate to POST /api/v1/sourcing/captures without holding a
-- session cookie. Only the hash is ever stored -- the raw token is shown
-- to the founder exactly once at issuance (see sourcing-token.service.ts).
-- No JWT/refresh-token machinery is reused here: a PAT is a fundamentally
-- different credential shape (long-lived, single-purpose, directly
-- revocable) from this codebase's existing session auth.
CREATE TABLE IF NOT EXISTS sourcing_api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    -- First few characters of the raw token, shown in the UI so the
    -- founder can tell tokens apart without ever re-displaying the full
    -- secret. Never sufficient on its own to authenticate.
    token_prefix VARCHAR(12) NOT NULL,
    -- SHA-256 hex digest of the raw token. Raw tokens are generated via
    -- crypto.randomBytes(32) -- high entropy, so a fast indexed hash
    -- lookup is the appropriate comparison (unlike a low-entropy user
    -- password, which needs bcrypt's deliberate slowness).
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['sourcing.import'],
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sourcing_api_tokens_hash
    ON sourcing_api_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sourcing_api_tokens_user
    ON sourcing_api_tokens(user_id);

COMMENT ON TABLE sourcing_api_tokens IS 'Revocable personal-access tokens for the sourcing browser extension. A token carries its issuing user''s own permission set through the normal requirePermission check -- no separate token-scope enforcement to keep in sync.';

-- =====================================================
-- SOURCING PRICING RULES
-- =====================================================
CREATE TABLE IF NOT EXISTS sourcing_pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('margin_percent', 'cost_plus_fixed')),
    -- Used when rule_type = 'margin_percent' -- e.g. 40.00 means
    -- sale_price = cost / (1 - 0.40), a true margin, not a markup.
    margin_percent DECIMAL(6,2),
    -- Used when rule_type = 'cost_plus_fixed' -- sale_price = cost + fixed_markup.
    fixed_markup DECIMAL(12,2),
    rounding_mode VARCHAR(10) NOT NULL DEFAULT 'charm'
        CHECK (rounding_mode IN ('none', 'charm', 'nearest_1')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- At most one default rule at a time -- previewProductSync-style pricing
-- suggestions fall back to whichever row has is_default = true when a
-- sourced product doesn't explicitly reference a rule.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sourcing_pricing_rules_one_default
    ON sourcing_pricing_rules(is_default) WHERE is_default = true;

COMMENT ON TABLE sourcing_pricing_rules IS 'Configurable markup rules for sourcing-suggested sale prices. Seeded with one default rule so pricing works immediately with zero founder configuration.';

INSERT INTO sourcing_pricing_rules (name, rule_type, margin_percent, rounding_mode, is_default)
SELECT 'Standard 40% margin', 'margin_percent', 40.00, 'charm', true
WHERE NOT EXISTS (SELECT 1 FROM sourcing_pricing_rules WHERE is_default = true);

-- =====================================================
-- SOURCED PRODUCTS
-- =====================================================
-- One row per captured product (not per batch -- capture is one button
-- click per product, not a bulk import). Never writes to the live
-- `products` table until an explicit commit -- see
-- sourced-product.service.ts's commitSourcedProduct().
CREATE TABLE IF NOT EXISTS sourced_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'captured'
        CHECK (status IN ('captured', 'rewriting', 'ready_for_review', 'review_edited', 'committed', 'rewrite_failed', 'discarded')),
    source_platform VARCHAR(20) NOT NULL CHECK (source_platform IN ('alibaba', 'amazon')),
    source_url TEXT NOT NULL,
    source_product_id VARCHAR(255),

    -- Raw captured data, exactly as the extension's content script read it
    -- off the rendered page -- kept forever as an audit trail, never
    -- mutated after capture.
    captured_title TEXT NOT NULL,
    captured_description_html TEXT,
    captured_images JSONB NOT NULL DEFAULT '[]',
    captured_price_tiers JSONB NOT NULL DEFAULT '[]',
    -- Reserved for a future phase -- product_variations is confirmed
    -- stub-only in this codebase (createProduct never inserts into it),
    -- so this phase never commits a multi-variant product. Captured here
    -- so the data isn't lost, deliberately unused by commitSourcedProduct.
    captured_variant_options JSONB NOT NULL DEFAULT '[]',
    captured_specs JSONB NOT NULL DEFAULT '{}',
    captured_currency CHAR(3) NOT NULL DEFAULT 'USD',
    -- The lowest-tier price in whatever currency the source page showed.
    captured_cost_price_original DECIMAL(12,2),
    -- Converted to EUR (this store's currency) at capture time. NULL, not
    -- a guessed value, if the FX lookup failed -- see sourcing-fx.service.ts.
    captured_cost_price_eur DECIMAL(12,2),
    fx_rate_used DECIMAL(12,6),
    fx_rate_source VARCHAR(50),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    captured_by_token_id UUID REFERENCES sourcing_api_tokens(id) ON DELETE SET NULL,
    captured_by_user_id UUID NOT NULL REFERENCES users(id),

    -- AI-rewritten content, populated asynchronously by
    -- sourcing-rewrite.worker.ts so the extension's capture call never
    -- blocks on an OpenAI round-trip.
    rewritten_title TEXT,
    rewritten_description_html TEXT,
    rewrite_model_name VARCHAR(100),
    rewrite_confidence SMALLINT CHECK (rewrite_confidence BETWEEN 0 AND 100),
    rewrite_notes TEXT,
    rewrite_attempted_at TIMESTAMP WITH TIME ZONE,
    rewrite_error TEXT,
    rewrite_attempt_count SMALLINT NOT NULL DEFAULT 0,

    -- Human review/edit layer -- these values, when present, always win
    -- over both captured_* and rewritten_* at commit time.
    review_title TEXT,
    review_description_html TEXT,
    review_images JSONB,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- Pricing -- suggested_* is computed automatically; final_* is what
    -- the founder actually edited/confirmed before commit.
    suggested_sale_price DECIMAL(12,2),
    suggested_margin_percent DECIMAL(6,2),
    pricing_rule_id UUID REFERENCES sourcing_pricing_rules(id) ON DELETE SET NULL,
    final_cost_price DECIMAL(12,2),
    final_sale_price DECIMAL(12,2),

    -- Commit linkage -- set exactly once, by commitSourcedProduct().
    committed_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    committed_at TIMESTAMP WITH TIME ZONE,
    committed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    discard_reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sourced_products_status ON sourced_products(status);
CREATE INDEX IF NOT EXISTS idx_sourced_products_captured_by ON sourced_products(captured_by_user_id);
-- Deliberately NOT unique -- re-importing the same source URL later
-- (e.g. checking a new price) is allowed; a real automated re-check
-- workflow is explicitly deferred to a later phase, but nothing here
-- should block a founder from manually re-capturing a page.
CREATE INDEX IF NOT EXISTS idx_sourced_products_source_url ON sourced_products(source_url);
CREATE INDEX IF NOT EXISTS idx_sourced_products_captured_at ON sourced_products(captured_at DESC);

COMMENT ON TABLE sourced_products IS 'Staging table for a product captured from Alibaba/Amazon via the browser extension. Never becomes a real products row until an explicit human commit -- see commitSourcedProduct(). Never populates product_variations (confirmed stub-only elsewhere in this codebase) -- always a single-SKU product.';
