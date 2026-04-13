-- =====================================================
-- NOTIFICATIONS SCHEMA
-- Complete notification system for e-commerce
-- =====================================================

-- 1. NOTIFICATION TYPES
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL, -- 'order_placed', 'user_signup', etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USER NOTIFICATION SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type_id UUID REFERENCES notification_types(id),
    in_app BOOLEAN DEFAULT TRUE,
    email BOOLEAN DEFAULT TRUE,
    push BOOLEAN DEFAULT TRUE,
    sms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type_id)
);

-- 3. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_id UUID REFERENCES notification_types(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    action_url VARCHAR(500),
    action_label VARCHAR(100),
    data JSONB DEFAULT '{}', -- Additional data like order_id, product_id, etc.
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- Delivery tracking
    email_sent BOOLEAN DEFAULT FALSE,
    push_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    push_sent_at TIMESTAMP,
    sms_sent_at TIMESTAMP,
    
    -- Priority and expiry
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    expires_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. NOTIFICATION TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id UUID NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    in_app_title VARCHAR(255),
    in_app_message TEXT,
    email_template TEXT,
    sms_template VARCHAR(160),
    push_title VARCHAR(255),
    push_message VARCHAR(255),
    
    -- Variables like {{order_number}}, {{customer_name}}, etc.
    variables JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. NOTIFICATION DELIVERY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    recipient VARCHAR(255),
    response_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. ADMIN NOTIFICATIONS (special handlers for admins)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'new_order', 'low_stock', 'user_signup', 'contact_message', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX idx_delivery_logs_notification_id ON notification_delivery_logs(notification_id);
CREATE INDEX idx_delivery_logs_status ON notification_delivery_logs(status);

-- =====================================================
-- INSERT DEFAULT NOTIFICATION TYPES
-- =====================================================
INSERT INTO notification_types (key, name, description, icon, color) VALUES
('order_placed', 'Order Placed', 'New order has been created', 'ShoppingCart', 'blue'),
('order_confirmed', 'Order Confirmed', 'Your order has been confirmed', 'CheckCircle', 'green'),
('order_processing', 'Processing', 'Your order is being prepared', 'Clock', 'yellow'),
('order_shipped', 'Order Shipped', 'Your order has been shipped', 'Truck', 'purple'),
('order_delivered', 'Delivered', 'Your order has been delivered', 'Gift', 'green'),
('order_cancelled', 'Order Cancelled', 'Your order has been cancelled', 'XCircle', 'red'),
('payment_received', 'Payment Received', 'Payment has been received', 'CreditCard', 'green'),
('payment_failed', 'Payment Failed', 'Payment processing failed', 'AlertTriangle', 'red'),
('user_signup', 'New User Sign Up', 'A new user has registered', 'UserPlus', 'blue'),
('contact_message', 'New Contact Message', 'New message from contact form', 'Mail', 'blue'),
('low_stock', 'Low Stock Alert', 'Product stock is running low', 'AlertTriangle', 'yellow'),
('back_in_stock', 'Back in Stock', 'Product is back in stock', 'CheckCircle', 'green'),
('review_submitted', 'New Review', 'Customer submitted a product review', 'Star', 'yellow'),
('wishlist_alert', 'Wishlist Update', 'Wishlist item is on sale', 'Heart', 'red'),
('account_verified', 'Account Verified', 'Your account has been verified', 'CheckCircle', 'green'),
('password_reset', 'Password Reset', 'Your password has been reset', 'Lock', 'orange')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- UPDATE TIMESTAMP TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_timestamp
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER trigger_update_user_notification_settings_timestamp
    BEFORE UPDATE ON user_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER trigger_update_notification_templates_timestamp
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_timestamp();
