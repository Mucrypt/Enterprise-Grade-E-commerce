-- =====================================================
-- UNIFIED ANALYTICS SCHEMA (Sprint 1)
-- Centralized event tracking for web, mobile, and API
-- Supports real-time analytics and anomaly detection
-- =====================================================

-- Create event type enum
CREATE TYPE event_type_enum AS ENUM (
    'product_view',
    'search',
    'add_to_cart',
    'remove_from_cart',
    'checkout_start',
    'payment_success',
    'order_created',
    'refund_created',
    'return_requested',
    'support_ticket_created',
    'product_favorite',
    'category_view',
    'filter_applied',
    'sort_applied',
    'checkout_abandoned',
    'promo_code_applied',
    'review_submitted',
    'supplier_interaction'
);

-- Create source enum
CREATE TYPE event_source_enum AS ENUM (
    'web_store',
    'mobile_app',
    'api',
    'admin_dashboard',
    'internal'
);

-- Create device type enum
CREATE TYPE device_type_enum AS ENUM (
    'desktop',
    'tablet',
    'mobile',
    'unknown'
);

-- Create severity enum for alerts
CREATE TYPE alert_severity_enum AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

-- User sessions tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    source event_source_enum NOT NULL,
    device_type device_type_enum DEFAULT 'unknown',
    os_name VARCHAR(100),
    os_version VARCHAR(50),
    browser_name VARCHAR(100),
    browser_version VARCHAR(50),
    ip_address INET,
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    session_duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core events table - unified across all sources
CREATE TABLE IF NOT EXISTS events_core (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type event_type_enum NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255) REFERENCES user_sessions(session_id) ON DELETE SET NULL,
    source event_source_enum NOT NULL,
    device_type device_type_enum DEFAULT 'unknown',
    
    -- Commerce context
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    sku VARCHAR(100),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    
    -- Campaign context
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE SET NULL,
    promo_code_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    
    -- Event payload - flexible JSONB for event-specific data
    -- Example: {"search_query": "laptop", "results_count": 142, "filters": ["price:100-500"]}
    -- Example: {"product_name": "MacBook Pro", "price": 1299.99, "discount": 0.1}
    -- Example: {"cart_value": 2599.98, "item_count": 2}
    payload JSONB DEFAULT '{}',
    
    -- Metrics
    value DECIMAL(12, 2),  -- quantity, amount, etc.
    duration_ms INTEGER,   -- time spent, operation duration
    
    -- Timestamps
    event_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event counts aggregates (materialized for performance)
CREATE TABLE IF NOT EXISTS event_aggregates_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type event_type_enum NOT NULL,
    source event_source_enum NOT NULL,
    hour_timestamp TIMESTAMP NOT NULL,
    event_count BIGINT DEFAULT 0,
    unique_users BIGINT DEFAULT 0,
    unique_sessions BIGINT DEFAULT 0,
    total_value DECIMAL(15, 2) DEFAULT 0,
    avg_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type, source, hour_timestamp)
);

-- Alerts table for anomaly detection
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL,  -- e.g., 'revenue_drop', 'high_refund_rate', 'checkout_abandonment'
    severity alert_severity_enum NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    current_value DECIMAL(12, 2),
    threshold_value DECIMAL(12, 2),
    baseline_value DECIMAL(12, 2),
    
    -- Context
    resource_type VARCHAR(100),  -- e.g., 'order', 'product', 'supplier', 'funnel'
    resource_id VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    acknowledged_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_source ON user_sessions(source);
CREATE INDEX IF NOT EXISTS idx_user_sessions_start_time ON user_sessions(start_time);

-- Events core indexes
CREATE INDEX IF NOT EXISTS idx_events_core_event_type ON events_core(event_type);
CREATE INDEX IF NOT EXISTS idx_events_core_user_id ON events_core(user_id);
CREATE INDEX IF NOT EXISTS idx_events_core_session_id ON events_core(session_id);
CREATE INDEX IF NOT EXISTS idx_events_core_source ON events_core(source);
CREATE INDEX IF NOT EXISTS idx_events_core_event_time ON events_core(event_time);
CREATE INDEX IF NOT EXISTS idx_events_core_timestamp ON events_core(created_at);
CREATE INDEX IF NOT EXISTS idx_events_core_product_id ON events_core(product_id);
CREATE INDEX IF NOT EXISTS idx_events_core_order_id ON events_core(order_id);
CREATE INDEX IF NOT EXISTS idx_events_core_campaign_id ON events_core(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_core_supplier_id ON events_core(supplier_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_core_event_time_source ON events_core(event_time DESC, source);
CREATE INDEX IF NOT EXISTS idx_events_core_user_event_time ON events_core(user_id, event_time DESC);

-- Event aggregates indexes
CREATE INDEX IF NOT EXISTS idx_event_aggregates_hourly_event_type ON event_aggregates_hourly(event_type);
CREATE INDEX IF NOT EXISTS idx_event_aggregates_hourly_source ON event_aggregates_hourly(source);
CREATE INDEX IF NOT EXISTS idx_event_aggregates_hourly_timestamp ON event_aggregates_hourly(hour_timestamp DESC);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resource ON alerts(resource_type, resource_id);

-- =====================================================
-- PARTITIONING SETUP (optional, for very high volume)
-- Uncomment when event volume exceeds 10M events/day
-- =====================================================

-- Partition events_core by month for better performance
-- ALTER TABLE events_core PARTITION BY RANGE (EXTRACT(YEAR FROM event_time) * 100 + EXTRACT(MONTH FROM event_time));
-- CREATE TABLE events_core_202601 PARTITION OF events_core FOR VALUES FROM (202601) TO (202602);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE events_core IS 'Unified analytics table storing all events from web, mobile, and API sources';
COMMENT ON COLUMN events_core.event_type IS 'Type of event: product_view, add_to_cart, checkout_start, etc.';
COMMENT ON COLUMN events_core.source IS 'Origin of the event: web_store, mobile_app, or api';
COMMENT ON COLUMN events_core.payload IS 'JSON payload with event-specific data (flexible schema)';
COMMENT ON TABLE user_sessions IS 'Session tracking for users across all platforms';
COMMENT ON TABLE alerts IS 'Anomaly detection alerts triggered by thresholds and patterns';
