-- WhatsApp Messages Table for Order Notifications
-- Migration: 014_whatsapp_messages.sql

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100),  -- Can be order ID (UUID) or order number
    recipient_phone VARCHAR(20) NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (message_type IN (
        'order_confirmation', 
        'order_status', 
        'shipping_update', 
        'delivery_confirmation', 
        'custom'
    )),
    message_content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 
        'sent', 
        'delivered', 
        'read', 
        'failed'
    )),
    provider_message_id VARCHAR(255),  -- Message ID from WhatsApp provider (Twilio/Meta)
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Settings Table for Admin Configuration
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Templates for Quick Messages
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    template_key VARCHAR(100) UNIQUE NOT NULL,
    message_content TEXT NOT NULL,
    variables JSONB,  -- List of variables like ["customerName", "orderNumber"]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_order_id ON whatsapp_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient_phone ON whatsapp_messages(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_type ON whatsapp_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);

-- Insert default settings
INSERT INTO whatsapp_settings (setting_key, setting_value, description) VALUES 
    ('enabled', 'true', 'Enable/disable WhatsApp notifications'),
    ('provider', 'twilio', 'WhatsApp provider: twilio or meta'),
    ('order_confirmation_enabled', 'true', 'Send WhatsApp on order confirmation'),
    ('status_update_enabled', 'true', 'Send WhatsApp on order status change'),
    ('shipping_update_enabled', 'true', 'Send WhatsApp when order ships'),
    ('delivery_confirmation_enabled', 'true', 'Send WhatsApp when order delivered')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default templates
INSERT INTO whatsapp_templates (name, template_key, message_content, variables) VALUES
    (
        'Order Confirmation', 
        'order_confirmation',
        '🎉 *Order Confirmed!*

Hi {{customerName}}! 👋

Your order *#{{orderNumber}}* has been confirmed! ✅

💰 *Total:* ${{grandTotal}}

We''ll send you updates as your order progresses!

Thank you for shopping with *TechTools Store* ⚡',
        '["customerName", "orderNumber", "grandTotal"]'
    ),
    (
        'Order Shipped',
        'order_shipped',
        '🚚 *Your Order Has Shipped!*

Hi {{customerName}}!

Your order *#{{orderNumber}}* is on its way! 📦

*Carrier:* {{carrier}}
*Tracking:* {{trackingNumber}}

*TechTools Store* ⚡',
        '["customerName", "orderNumber", "carrier", "trackingNumber"]'
    ),
    (
        'Order Delivered',
        'order_delivered',
        '🎉 *Order Delivered!*

Hi {{customerName}}!

Your order *#{{orderNumber}}* has been delivered! 📦✅

We hope you love your purchase!

*TechTools Store* ⚡',
        '["customerName", "orderNumber"]'
    )
ON CONFLICT (template_key) DO NOTHING;

-- Add comments
COMMENT ON TABLE whatsapp_messages IS 'Stores all WhatsApp messages sent to customers';
COMMENT ON TABLE whatsapp_settings IS 'Admin configurable settings for WhatsApp integration';
COMMENT ON TABLE whatsapp_templates IS 'Pre-defined message templates for quick sending';
