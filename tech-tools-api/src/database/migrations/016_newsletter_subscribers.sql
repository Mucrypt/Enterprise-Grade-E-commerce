-- Newsletter Subscribers Table
-- Migration: 016_newsletter_subscribers.sql

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 
        'unsubscribed', 
        'bounced'
    )),
    source VARCHAR(50) DEFAULT 'website' CHECK (source IN (
        'website',
        'checkout',
        'popup',
        'footer',
        'import',
        'admin'
    )),
    ip_address VARCHAR(45),
    user_agent TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Campaigns Table for sending bulk emails
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    content_html TEXT NOT NULL,
    content_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 
        'scheduled', 
        'sending', 
        'sent', 
        'cancelled'
    )),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter Campaign Recipients (for tracking individual sends)
CREATE TABLE IF NOT EXISTS newsletter_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'unsubscribed'
    )),
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, subscriber_id)
);

-- Newsletter Settings
CREATE TABLE IF NOT EXISTS newsletter_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at ON newsletter_subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_scheduled_at ON newsletter_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_campaign_id ON newsletter_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_subscriber_id ON newsletter_campaign_recipients(subscriber_id);

-- Insert default settings
INSERT INTO newsletter_settings (setting_key, setting_value, description) VALUES 
    ('welcome_email_enabled', 'true', 'Send welcome email to new subscribers'),
    ('double_opt_in', 'false', 'Require email confirmation from subscribers'),
    ('welcome_subject', 'Welcome to TechTools Newsletter!', 'Subject for welcome email'),
    ('welcome_message', '<h1>Welcome!</h1><p>Thank you for subscribing to our newsletter. You''ll get 10% off your first order!</p>', 'Welcome email content'),
    ('unsubscribe_message', '<h1>Sorry to see you go!</h1><p>You have been successfully unsubscribed from our newsletter.</p>', 'Unsubscribe confirmation message'),
    ('from_name', 'TechTools Store', 'Newsletter sender name'),
    ('from_email', 'newsletter@techtoolstore.com', 'Newsletter sender email')
ON CONFLICT (setting_key) DO NOTHING;
