-- Three independent additions, bundled in one migration because they ship
-- together as one feature batch:
--
-- 1. categories.show_in_nav -- curation flag so the storefront header can
--    build its mega-menu from real category data instead of a hardcoded
--    array, without every one of the ~dozens of categories cluttering it.
--
-- 2. category_attributes / product_attribute_values -- a NEW, deliberately
--    separate structured-attribute system (Voltage, Material, Power
--    Source...). Does not touch or migrate product_specifications, which
--    stays exactly as it is: free-text, ungrouped, written only by the
--    AI-sourcing review flow. This pair exists because that table has zero
--    controlled vocabulary and can't safely back a filter UI -- see
--    tech-tools-api's product.controller.ts audit notes from this session.
--
-- 3. pg_trgm -- typo-tolerant product search. Ships in postgres:15-alpine's
--    contrib modules already, no version upgrade needed.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_in_nav BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS category_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('text', 'number', 'select')),
    -- Admin-defined controlled vocabulary for 'select' -- this IS the
    -- normalization product_specifications never had, e.g. {'12V','18V','20V'}.
    options TEXT[],
    unit VARCHAR(20),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_filterable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);
CREATE INDEX IF NOT EXISTS idx_category_attributes_category ON category_attributes(category_id);

CREATE TABLE IF NOT EXISTS product_attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, attribute_id)
);
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_lookup ON product_attribute_values(attribute_id, value);
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_product ON product_attribute_values(product_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
