-- Fix Newsletter Campaigns Table (removes admin_users FK dependency)
-- Migration: 017_fix_newsletter_campaigns.sql

-- Drop the campaign tables if they exist with errors
DROP TABLE IF EXISTS newsletter_campaign_recipients CASCADE;
DROP TABLE IF EXISTS newsletter_campaigns CASCADE;

-- Recreate Newsletter Campaigns Table without admin_users FK
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
    created_by UUID,  -- No FK reference, just stores the user ID
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

-- Create indexes for campaign tables
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_scheduled_at ON newsletter_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_campaign_id ON newsletter_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_subscriber_id ON newsletter_campaign_recipients(subscriber_id);
