-- Email Messages Table for Order Notifications
-- Migration: 015_email_messages.sql

CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100),  -- Can be order ID (UUID) or order number
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    email_type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (email_type IN (
        'order_confirmation', 
        'order_status', 
        'shipping_update', 
        'delivery_confirmation', 
        'welcome',
        'password_reset',
        'verification',
        'promotional',
        'custom'
    )),
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 
        'sent', 
        'delivered', 
        'bounced', 
        'failed'
    )),
    smtp_message_id VARCHAR(255),  -- Message ID from SMTP server
    error_message TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    reply_to VARCHAR(255),
    cc VARCHAR(500),
    bcc VARCHAR(500),
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email Settings Table for Admin Configuration
CREATE TABLE IF NOT EXISTS email_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email Templates for Quick Messages
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    template_key VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB,  -- List of variables like ["customerName", "orderNumber"]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email Aliases for different purposes
CREATE TABLE IF NOT EXISTS email_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias_email VARCHAR(255) UNIQUE NOT NULL,
    alias_name VARCHAR(255) NOT NULL,
    purpose VARCHAR(100) NOT NULL,  -- 'orders', 'support', 'marketing', 'noreply'
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 465,
    smtp_secure BOOLEAN DEFAULT TRUE,
    smtp_user VARCHAR(255),
    smtp_pass_encrypted TEXT,  -- Encrypted password
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_messages_order_id ON email_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient ON email_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_email_type ON email_messages(email_type);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);

-- Insert default settings
INSERT INTO email_settings (setting_key, setting_value, description) VALUES 
    ('enabled', 'true', 'Enable/disable email notifications'),
    ('provider', 'smtp', 'Email provider: smtp, sendgrid, ses'),
    ('order_confirmation_enabled', 'true', 'Send email on order confirmation'),
    ('status_update_enabled', 'true', 'Send email on order status change'),
    ('shipping_update_enabled', 'true', 'Send email when order ships'),
    ('delivery_confirmation_enabled', 'true', 'Send email when order delivered'),
    ('marketing_enabled', 'false', 'Enable marketing/promotional emails'),
    ('default_from_name', 'TechTools Store', 'Default sender name'),
    ('default_reply_to', 'support@techtoolstore.com', 'Default reply-to address')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default alias for orders
INSERT INTO email_aliases (alias_email, alias_name, purpose, smtp_host, smtp_port, smtp_secure, is_default) VALUES
    ('noreply@techtoolstore.com', 'TechTools Store', 'orders', 'smtp.hostinger.com', 465, true, true)
ON CONFLICT (alias_email) DO NOTHING;
