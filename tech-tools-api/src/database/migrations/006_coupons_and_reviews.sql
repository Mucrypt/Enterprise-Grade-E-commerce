-- =====================================================
-- Coupons & Promotions Schema
-- Enterprise-grade discount and promotional system
-- =====================================================

-- Coupon Types Enum
DO $$ BEGIN
    CREATE TYPE coupon_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Coupon Status Enum
DO $$ BEGIN
    CREATE TYPE coupon_status AS ENUM ('active', 'inactive', 'expired', 'scheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Discount Configuration
    discount_type coupon_type DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL,
    max_discount_amount DECIMAL(10,2), -- Cap for percentage discounts
    
    -- Usage Limits
    usage_limit INTEGER, -- Total uses allowed (null = unlimited)
    usage_count INTEGER DEFAULT 0,
    usage_limit_per_user INTEGER DEFAULT 1, -- Per customer limit
    
    -- Validity Period
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Minimum Requirements
    min_purchase_amount DECIMAL(10,2),
    min_items_count INTEGER,
    
    -- Restrictions
    is_first_order_only BOOLEAN DEFAULT FALSE,
    is_single_use BOOLEAN DEFAULT FALSE,
    is_stackable BOOLEAN DEFAULT FALSE, -- Can combine with other coupons
    
    -- Targeting
    applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN (
        'all', 'categories', 'products', 'brands', 'collections', 'user_segments'
    )),
    target_ids UUID[], -- Array of category/product/brand IDs
    excluded_product_ids UUID[],
    excluded_category_ids UUID[],
    
    -- Buy X Get Y Configuration (for BOGO deals)
    buy_quantity INTEGER,
    get_quantity INTEGER,
    get_discount_percent DECIMAL(5,2), -- e.g., 100 for free, 50 for half off
    
    -- Status
    status coupon_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Analytics
    total_discount_given DECIMAL(12,2) DEFAULT 0,
    total_orders_used INTEGER DEFAULT 0,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Coupon Usage History
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    order_total DECIMAL(10,2),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- User-specific coupon assignments (for targeted promotions)
CREATE TABLE IF NOT EXISTS user_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    is_used BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, coupon_id)
);

-- =====================================================
-- Enhanced Reviews Schema
-- Additional tables for review features
-- =====================================================

-- Review Images
CREATE TABLE IF NOT EXISTS review_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Review Votes (helpful/not helpful)
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) CHECK (vote_type IN ('helpful', 'not_helpful', 'reported')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id, vote_type)
);

-- Review Responses (seller/admin replies)
CREATE TABLE IF NOT EXISTS review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
    response TEXT NOT NULL,
    is_official BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Review Summary Cache (for performance)
CREATE TABLE IF NOT EXISTS product_review_summary (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    rating_1_count INTEGER DEFAULT 0,
    rating_2_count INTEGER DEFAULT 0,
    rating_3_count INTEGER DEFAULT 0,
    rating_4_count INTEGER DEFAULT 0,
    rating_5_count INTEGER DEFAULT 0,
    verified_purchase_count INTEGER DEFAULT 0,
    with_images_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to reviews table if not exists
DO $$
BEGIN
    -- Add images_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'images_count') THEN
        ALTER TABLE reviews ADD COLUMN images_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add admin_response column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'admin_response') THEN
        ALTER TABLE reviews ADD COLUMN admin_response TEXT;
    END IF;
    
    -- Add response_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'response_at') THEN
        ALTER TABLE reviews ADD COLUMN response_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add is_featured column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'is_featured') THEN
        ALTER TABLE reviews ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'status') THEN
        ALTER TABLE reviews ADD COLUMN status VARCHAR(20) DEFAULT 'pending' 
            CHECK (status IN ('pending', 'approved', 'rejected', 'flagged'));
    END IF;
    
    -- Add reported_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reviews' AND column_name = 'reported_count') THEN
        ALTER TABLE reviews ADD COLUMN reported_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Coupon Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON coupons(starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_coupons_applies_to ON coupons(applies_to);

-- Coupon Usage Indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at);

-- User Coupons Indexes
CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon_id ON user_coupons(coupon_id);

-- Review Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_review_id ON review_responses(review_id);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update product review summary
CREATE OR REPLACE FUNCTION update_product_review_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO product_review_summary (product_id, total_reviews, average_rating,
        rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
        verified_purchase_count, with_images_count, updated_at)
    SELECT 
        COALESCE(NEW.product_id, OLD.product_id),
        COUNT(*),
        COALESCE(AVG(rating), 0),
        COUNT(*) FILTER (WHERE rating = 1),
        COUNT(*) FILTER (WHERE rating = 2),
        COUNT(*) FILTER (WHERE rating = 3),
        COUNT(*) FILTER (WHERE rating = 4),
        COUNT(*) FILTER (WHERE rating = 5),
        COUNT(*) FILTER (WHERE is_verified_purchase = TRUE),
        COUNT(*) FILTER (WHERE images_count > 0),
        NOW()
    FROM reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND is_approved = TRUE
    ON CONFLICT (product_id) DO UPDATE SET
        total_reviews = EXCLUDED.total_reviews,
        average_rating = EXCLUDED.average_rating,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        verified_purchase_count = EXCLUDED.verified_purchase_count,
        with_images_count = EXCLUDED.with_images_count,
        updated_at = NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for review summary updates
DROP TRIGGER IF EXISTS trigger_update_review_summary ON reviews;
CREATE TRIGGER trigger_update_review_summary
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_product_review_summary();

-- Function to update coupon usage count
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE coupons 
        SET usage_count = usage_count + 1,
            total_orders_used = total_orders_used + 1,
            total_discount_given = total_discount_given + NEW.discount_applied,
            updated_at = NOW()
        WHERE id = NEW.coupon_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for coupon usage updates
DROP TRIGGER IF EXISTS trigger_update_coupon_usage ON coupon_usage;
CREATE TRIGGER trigger_update_coupon_usage
    AFTER INSERT ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_coupon_usage_count();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_responses_updated_at ON review_responses;
CREATE TRIGGER update_review_responses_updated_at
    BEFORE UPDATE ON review_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Sample Data
-- =====================================================

-- Insert sample coupons
INSERT INTO coupons (code, name, description, discount_type, discount_value, max_discount_amount, usage_limit, min_purchase_amount, starts_at, expires_at)
VALUES 
    ('WELCOME10', 'Welcome Discount', 'Get 10% off on your first order', 'percentage', 10, 50, NULL, 25, NOW(), NOW() + INTERVAL '1 year'),
    ('SAVE20', 'Save $20', 'Get $20 off orders over $100', 'fixed_amount', 20, NULL, 500, 100, NOW(), NOW() + INTERVAL '3 months'),
    ('FREESHIP', 'Free Shipping', 'Free shipping on all orders', 'free_shipping', 0, NULL, 1000, 50, NOW(), NOW() + INTERVAL '1 month'),
    ('SUMMER25', 'Summer Sale', '25% off summer collection', 'percentage', 25, 100, 200, 50, NOW(), NOW() + INTERVAL '2 months')
ON CONFLICT (code) DO NOTHING;
