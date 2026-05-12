-- Phase 3: A/B newsletter variants + deliverability/complaints
-- Migration: 023_phase3_ab_deliverability_guardrails.sql

ALTER TABLE newsletter_campaigns
  ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subject_a VARCHAR(500),
  ADD COLUMN IF NOT EXISTS subject_b VARCHAR(500),
  ADD COLUMN IF NOT EXISTS content_html_a TEXT,
  ADD COLUMN IF NOT EXISTS content_html_b TEXT,
  ADD COLUMN IF NOT EXISTS content_text_a TEXT,
  ADD COLUMN IF NOT EXISTS content_text_b TEXT,
  ADD COLUMN IF NOT EXISTS segment_a JSONB,
  ADD COLUMN IF NOT EXISTS segment_b JSONB;

ALTER TABLE newsletter_campaign_recipients
  ADD COLUMN IF NOT EXISTS variant_key CHAR(1) NOT NULL DEFAULT 'A' CHECK (variant_key IN ('A', 'B'));

CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_variant
  ON newsletter_campaign_recipients(campaign_id, variant_key);

CREATE TABLE IF NOT EXISTS email_complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE SET NULL,
  provider VARCHAR(80),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_complaints_created_at
  ON email_complaints(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_complaints_campaign_id
  ON email_complaints(campaign_id);

INSERT INTO newsletter_settings (setting_key, setting_value, description)
VALUES
  ('domain_health_warn_threshold', '70', 'Health score threshold that should trigger warning'),
  ('domain_health_critical_threshold', '45', 'Health score threshold that should trigger critical state')
ON CONFLICT (setting_key) DO NOTHING;
