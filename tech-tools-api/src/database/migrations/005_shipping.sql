-- Shipping Carriers Configuration
CREATE TABLE IF NOT EXISTS shipping_carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_code VARCHAR(20) UNIQUE NOT NULL,
    carrier_name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT FALSE,
    is_sandbox BOOLEAN DEFAULT TRUE,
    credentials JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default carriers
INSERT INTO shipping_carriers (carrier_code, carrier_name, description, is_active, is_sandbox) 
VALUES 
    ('fedex', 'FedEx', 'FedEx Express shipping services', false, true),
    ('ups', 'UPS', 'United Parcel Service shipping', false, true),
    ('dhl', 'DHL Express', 'DHL Express international shipping', false, true)
ON CONFLICT (carrier_code) DO NOTHING;

-- Shipping Settings
CREATE TABLE IF NOT EXISTS shipping_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    default_weight_unit VARCHAR(10) DEFAULT 'lb',
    default_dimension_unit VARCHAR(10) DEFAULT 'in',
    default_country VARCHAR(2) DEFAULT 'US',
    free_shipping_threshold DECIMAL(10,2),
    handling_fee DECIMAL(10,2) DEFAULT 0,
    insurance_enabled BOOLEAN DEFAULT FALSE,
    signature_required BOOLEAN DEFAULT FALSE,
    origin_address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO shipping_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Shipping Labels (for tracking created shipments)
CREATE TABLE IF NOT EXISTS shipping_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    carrier VARCHAR(20) NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    label_data TEXT,
    label_format VARCHAR(10) DEFAULT 'PDF',
    cost DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'created',
    voided_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipping Zones (for custom shipping rules)
CREATE TABLE IF NOT EXISTS shipping_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    countries TEXT[] DEFAULT '{}',
    states TEXT[] DEFAULT '{}',
    postal_codes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipping Methods (flat rate shipping options)
CREATE TABLE IF NOT EXISTS shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID REFERENCES shipping_zones(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    method_type VARCHAR(50) DEFAULT 'flat_rate' 
        CHECK (method_type IN ('flat_rate', 'free', 'weight_based', 'price_based', 'carrier')),
    carrier VARCHAR(20),
    carrier_service_code VARCHAR(50),
    flat_rate DECIMAL(10,2),
    min_weight DECIMAL(10,2),
    max_weight DECIMAL(10,2),
    min_order_amount DECIMAL(10,2),
    max_order_amount DECIMAL(10,2),
    rate_per_kg DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tracking Updates History
CREATE TABLE IF NOT EXISTS shipping_tracking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label_id UUID REFERENCES shipping_labels(id) ON DELETE CASCADE,
    tracking_number VARCHAR(100) NOT NULL,
    carrier VARCHAR(20) NOT NULL,
    status VARCHAR(100),
    status_description TEXT,
    location VARCHAR(255),
    event_timestamp TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_carrier ON shipping_labels(carrier);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_history_label ON shipping_tracking_history(label_id);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_history_tracking ON shipping_tracking_history(tracking_number);
