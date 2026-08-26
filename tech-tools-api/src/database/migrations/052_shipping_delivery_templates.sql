-- Admin-editable delivery ESTIMATE templates (marketing copy: "FREE Delivery
-- Thursday, 3 September"), resolved per (product, country) at request time.
-- This is deliberately separate from shipping_carriers/shipping_methods/
-- shipping_zones (005_shipping.sql), which calculate real shipping cost and
-- tracking via live carrier APIs -- nothing here touches that system.
--
-- Resolution precedence (most specific wins, see delivery-estimate.service.ts):
--   1. products.delivery_template_id (per-product override)
--   2. shipping_delivery_template_categories (per-category assignment)
--   3. scope_type='location', countryCode = ANY(countries)
--   4. is_default=true (the one required global fallback, seeded below)

CREATE TABLE IF NOT EXISTS shipping_delivery_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'location', 'category')),
    -- Only meaningful when scope_type = 'location'.
    countries TEXT[] NOT NULL DEFAULT '{}',
    processing_days_min INTEGER NOT NULL DEFAULT 1,
    processing_days_max INTEGER NOT NULL DEFAULT 2,
    transit_days_min INTEGER NOT NULL DEFAULT 2,
    transit_days_max INTEGER NOT NULL DEFAULT 4,
    -- Null pair = no "fastest delivery" line shown for this template.
    express_transit_days_min INTEGER,
    express_transit_days_max INTEGER,
    -- Reserved for v2 (order-cutoff-aware processing-day calculation).
    -- Unused by the v1 resolver and intentionally not exposed in the v1
    -- admin form -- a control that looks configurable but silently does
    -- nothing is worse than not having it yet.
    cutoff_time TIME,
    cutoff_timezone VARCHAR(64),
    skip_weekends BOOLEAN NOT NULL DEFAULT true,
    standard_label VARCHAR(100) NOT NULL DEFAULT 'FREE Delivery',
    express_label VARCHAR(100) NOT NULL DEFAULT 'Or fastest delivery',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (processing_days_min <= processing_days_max),
    CHECK (transit_days_min <= transit_days_max),
    CHECK (
        (express_transit_days_min IS NULL AND express_transit_days_max IS NULL)
        OR (express_transit_days_min IS NOT NULL AND express_transit_days_max IS NOT NULL
            AND express_transit_days_min <= express_transit_days_max)
    )
);

-- At most one global-fallback template -- same technique as
-- sourcing_pricing_rules' one-default row (048_sourcing_foundation.sql).
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_delivery_templates_one_default
    ON shipping_delivery_templates(is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_shipping_delivery_templates_countries
    ON shipping_delivery_templates USING GIN(countries) WHERE scope_type = 'location' AND is_active = true;

COMMENT ON TABLE shipping_delivery_templates IS 'Admin-configurable delivery date-range estimates (marketing copy, NOT live carrier rates -- see shipping_methods/005_shipping.sql for that). Seeded with one default so the storefront widget works with zero admin configuration.';

INSERT INTO shipping_delivery_templates (name, scope_type, processing_days_min, processing_days_max, transit_days_min, transit_days_max, is_default)
SELECT 'Standard delivery', 'global', 1, 2, 3, 5, true
WHERE NOT EXISTS (SELECT 1 FROM shipping_delivery_templates WHERE is_default = true);

-- Each category belongs to at most one template -- UNIQUE(category_id)
-- removes any priority ambiguity at the category resolution tier.
CREATE TABLE IF NOT EXISTS shipping_delivery_template_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES shipping_delivery_templates(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_delivery_template_categories_template
    ON shipping_delivery_template_categories(template_id);

-- Product-level override -- any active template (global/location/category
-- scope, doesn't matter) can be assigned here directly for one-off exceptions.
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_template_id UUID
    REFERENCES shipping_delivery_templates(id) ON DELETE SET NULL;
