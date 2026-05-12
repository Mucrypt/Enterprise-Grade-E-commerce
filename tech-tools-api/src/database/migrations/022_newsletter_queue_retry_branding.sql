-- Newsletter Queue, Retry, and Branding Settings
-- Migration: 022_newsletter_queue_retry_branding.sql

-- Campaign-level queue controls
ALTER TABLE newsletter_campaigns
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_backoff_seconds INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP WITH TIME ZONE;

-- Recipient-level retry tracking
ALTER TABLE newsletter_campaign_recipients
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Helpful queue indexes
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status_scheduled
  ON newsletter_campaigns(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_next_attempt
  ON newsletter_campaign_recipients(campaign_id, status, next_attempt_at);

-- Branding + communication controls (for admin settings panel)
INSERT INTO newsletter_settings (setting_key, setting_value, description)
VALUES
  ('brand_name', 'TechTools Store', 'Brand display name used in communications'),
  ('brand_logo_url', '', 'Absolute URL for email logo image'),
  ('brand_primary_color', '#f97316', 'Primary brand color for email templates'),
  ('support_email', 'support@techtoolstore.com', 'Support email shown in communication footers')
ON CONFLICT (setting_key) DO NOTHING;
