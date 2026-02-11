-- =====================================================
-- Media and Collections Schema Migration
-- Version: 003
-- Description: Enterprise-grade media management (images/videos)
--              and collections for products and categories
-- Features: - Multi-format media support with optimization
--           - CDN-ready URL structure
--           - Position-based ordering
--           - Collections with featured items
--           - Performance indexes
-- =====================================================

-- =====================================================
-- 1. PRODUCT MEDIA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video')),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text TEXT,
    title VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    
    -- File metadata for optimization
    file_size INTEGER, -- in bytes
    width INTEGER,
    height INTEGER,
    format VARCHAR(20), -- jpg, png, webp, mp4, etc.
    duration INTEGER, -- for videos in seconds
    
    -- CDN and optimization
    cdn_urls JSONB DEFAULT '{}', -- {thumbnail: '', small: '', medium: '', large: '', original: ''}
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_position CHECK (position >= 0),
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_dimensions CHECK (width > 0 AND height > 0)
);

-- =====================================================
-- 2. CATEGORY MEDIA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS category_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video')),
    media_purpose VARCHAR(50) NOT NULL CHECK (media_purpose IN ('thumbnail', 'banner', 'icon', 'video')),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text TEXT,
    title VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0,
    
    -- File metadata
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format VARCHAR(20),
    duration INTEGER,
    
    -- CDN and optimization
    cdn_urls JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_position_cat CHECK (position >= 0),
    CONSTRAINT valid_file_size_cat CHECK (file_size > 0)
);

-- =====================================================
-- 3. PRODUCT COLLECTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS product_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(500),
    
    -- Media
    image_url TEXT,
    banner_url TEXT,
    
    -- Status and visibility
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'hidden')),
    
    -- Display settings
    position INTEGER DEFAULT 0,
    display_order VARCHAR(20) DEFAULT 'manual' CHECK (display_order IN ('manual', 'newest', 'popular', 'price_asc', 'price_desc')),
    items_count INTEGER DEFAULT 0,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Scheduling
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    
    -- Audit fields
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_collection_position CHECK (position >= 0),
    CONSTRAINT valid_items_count CHECK (items_count >= 0),
    CONSTRAINT valid_schedule CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

-- =====================================================
-- 4. PRODUCT COLLECTION ITEMS (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS product_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES product_collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT unique_product_in_collection UNIQUE (collection_id, product_id),
    CONSTRAINT valid_item_position CHECK (position >= 0)
);

-- =====================================================
-- 5. CATEGORY COLLECTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS category_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(500),
    
    -- Media
    image_url TEXT,
    banner_url TEXT,
    
    -- Status and visibility
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'hidden')),
    
    -- Display settings
    position INTEGER DEFAULT 0,
    display_order VARCHAR(20) DEFAULT 'manual' CHECK (display_order IN ('manual', 'alphabetical', 'newest', 'popular')),
    items_count INTEGER DEFAULT 0,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Scheduling
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    
    -- Audit fields
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_cat_collection_position CHECK (position >= 0),
    CONSTRAINT valid_cat_items_count CHECK (items_count >= 0),
    CONSTRAINT valid_cat_schedule CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

-- =====================================================
-- 6. CATEGORY COLLECTION ITEMS (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS category_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES category_collections(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT unique_category_in_collection UNIQUE (collection_id, category_id),
    CONSTRAINT valid_cat_item_position CHECK (position >= 0)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE (Enterprise-Grade)
-- =====================================================

-- Product Media Indexes
CREATE INDEX idx_product_media_product_id ON product_media(product_id);
CREATE INDEX idx_product_media_type ON product_media(type);
CREATE INDEX idx_product_media_position ON product_media(product_id, position);
CREATE INDEX idx_product_media_primary ON product_media(product_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_product_media_created_at ON product_media(created_at DESC);

-- Category Media Indexes
CREATE INDEX idx_category_media_category_id ON category_media(category_id);
CREATE INDEX idx_category_media_type ON category_media(type);
CREATE INDEX idx_category_media_purpose ON category_media(category_id, media_purpose);
CREATE INDEX idx_category_media_position ON category_media(category_id, position);

-- Product Collections Indexes
CREATE INDEX idx_product_collections_slug ON product_collections(slug);
CREATE INDEX idx_product_collections_active ON product_collections(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_product_collections_featured ON product_collections(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_product_collections_position ON product_collections(position) WHERE is_active = TRUE;
CREATE INDEX idx_product_collections_visibility ON product_collections(visibility, is_active);
CREATE INDEX idx_product_collections_schedule ON product_collections(starts_at, ends_at) WHERE is_active = TRUE;
CREATE INDEX idx_product_collections_created_at ON product_collections(created_at DESC);

-- Product Collection Items Indexes
CREATE INDEX idx_product_collection_items_collection ON product_collection_items(collection_id, position);
CREATE INDEX idx_product_collection_items_product ON product_collection_items(product_id);
CREATE INDEX idx_product_collection_items_featured ON product_collection_items(collection_id, is_featured) WHERE is_featured = TRUE;

-- Category Collections Indexes
CREATE INDEX idx_category_collections_slug ON category_collections(slug);
CREATE INDEX idx_category_collections_active ON category_collections(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_category_collections_featured ON category_collections(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_category_collections_position ON category_collections(position) WHERE is_active = TRUE;
CREATE INDEX idx_category_collections_visibility ON category_collections(visibility, is_active);

-- Category Collection Items Indexes
CREATE INDEX idx_category_collection_items_collection ON category_collection_items(collection_id, position);
CREATE INDEX idx_category_collection_items_category ON category_collection_items(category_id);
CREATE INDEX idx_category_collection_items_featured ON category_collection_items(collection_id, is_featured) WHERE is_featured = TRUE;

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE
-- =====================================================

-- Update updated_at timestamp for product_media
CREATE OR REPLACE FUNCTION update_product_media_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_media_timestamp
    BEFORE UPDATE ON product_media
    FOR EACH ROW
    EXECUTE FUNCTION update_product_media_timestamp();

-- Update updated_at timestamp for category_media
CREATE OR REPLACE FUNCTION update_category_media_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_media_timestamp
    BEFORE UPDATE ON category_media
    FOR EACH ROW
    EXECUTE FUNCTION update_category_media_timestamp();

-- Update updated_at timestamp for product_collections
CREATE OR REPLACE FUNCTION update_product_collections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_collections_timestamp
    BEFORE UPDATE ON product_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_product_collections_timestamp();

-- Update updated_at timestamp for category_collections
CREATE OR REPLACE FUNCTION update_category_collections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_collections_timestamp
    BEFORE UPDATE ON category_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_category_collections_timestamp();

-- Auto-update items_count in product_collections
CREATE OR REPLACE FUNCTION update_product_collection_items_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE product_collections 
        SET items_count = items_count + 1 
        WHERE id = NEW.collection_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE product_collections 
        SET items_count = GREATEST(0, items_count - 1) 
        WHERE id = OLD.collection_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_collection_items_count
    AFTER INSERT OR DELETE ON product_collection_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_collection_items_count();

-- Auto-update items_count in category_collections
CREATE OR REPLACE FUNCTION update_category_collection_items_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE category_collections 
        SET items_count = items_count + 1 
        WHERE id = NEW.collection_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE category_collections 
        SET items_count = GREATEST(0, items_count - 1) 
        WHERE id = OLD.collection_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_category_collection_items_count
    AFTER INSERT OR DELETE ON category_collection_items
    FOR EACH ROW
    EXECUTE FUNCTION update_category_collection_items_count();

-- Ensure only one primary media per product
CREATE OR REPLACE FUNCTION ensure_single_primary_product_media()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        UPDATE product_media 
        SET is_primary = FALSE 
        WHERE product_id = NEW.product_id 
        AND id != NEW.id 
        AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_product_media
    BEFORE INSERT OR UPDATE ON product_media
    FOR EACH ROW
    WHEN (NEW.is_primary = TRUE)
    EXECUTE FUNCTION ensure_single_primary_product_media();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Products with media count
CREATE OR REPLACE VIEW products_with_media_stats AS
SELECT 
    p.id,
    p.name,
    p.slug,
    COUNT(pm.id) FILTER (WHERE pm.type = 'image') as images_count,
    COUNT(pm.id) FILTER (WHERE pm.type = 'video') as videos_count,
    COUNT(pm.id) as total_media_count,
    (SELECT url FROM product_media WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image_url,
    (SELECT url FROM product_media WHERE product_id = p.id AND type = 'image' ORDER BY position LIMIT 1) as first_image_url
FROM products p
LEFT JOIN product_media pm ON p.id = pm.product_id
GROUP BY p.id, p.name, p.slug;

-- View: Categories with media count
CREATE OR REPLACE VIEW categories_with_media_stats AS
SELECT 
    c.id,
    c.name,
    c.slug,
    COUNT(cm.id) FILTER (WHERE cm.type = 'image') as images_count,
    COUNT(cm.id) FILTER (WHERE cm.type = 'video') as videos_count,
    COUNT(cm.id) as total_media_count,
    (SELECT url FROM category_media WHERE category_id = c.id AND media_purpose = 'thumbnail' ORDER BY position LIMIT 1) as thumbnail_url,
    (SELECT url FROM category_media WHERE category_id = c.id AND media_purpose = 'banner' ORDER BY position LIMIT 1) as banner_url
FROM categories c
LEFT JOIN category_media cm ON c.id = cm.category_id
GROUP BY c.id, c.name, c.slug;

-- View: Active product collections with items
CREATE OR REPLACE VIEW active_product_collections_with_stats AS
SELECT 
    pc.*,
    COUNT(pci.id) as current_items_count,
    ARRAY_AGG(p.id ORDER BY pci.position) FILTER (WHERE p.id IS NOT NULL) as product_ids
FROM product_collections pc
LEFT JOIN product_collection_items pci ON pc.id = pci.collection_id
LEFT JOIN products p ON pci.product_id = p.id AND p.is_active = TRUE
WHERE pc.is_active = TRUE
    AND (pc.starts_at IS NULL OR pc.starts_at <= CURRENT_TIMESTAMP)
    AND (pc.ends_at IS NULL OR pc.ends_at > CURRENT_TIMESTAMP)
GROUP BY pc.id;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE product_media IS 'Stores images and videos for products with CDN optimization support';
COMMENT ON TABLE category_media IS 'Stores images and videos for categories (thumbnails, banners, icons)';
COMMENT ON TABLE product_collections IS 'Product collections for organizing products into groups (e.g., Summer Sale, New Arrivals)';
COMMENT ON TABLE product_collection_items IS 'Junction table mapping products to collections with positioning';
COMMENT ON TABLE category_collections IS 'Category collections for organizing categories into groups';
COMMENT ON TABLE category_collection_items IS 'Junction table mapping categories to collections with positioning';

COMMENT ON COLUMN product_media.cdn_urls IS 'JSONB storing optimized URLs for different sizes: {thumbnail, small, medium, large, original}';
COMMENT ON COLUMN product_collections.display_order IS 'How products are ordered in the collection: manual, newest, popular, price_asc, price_desc';
COMMENT ON COLUMN product_collections.visibility IS 'Collection visibility: public (shown to all), private (requires auth), hidden (admin only)';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
