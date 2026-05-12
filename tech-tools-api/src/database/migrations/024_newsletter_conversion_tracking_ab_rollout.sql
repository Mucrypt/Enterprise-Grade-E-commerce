-- Phase 4: conversion tracking + A/B auto winner rollout
-- Migration: 024_newsletter_conversion_tracking_ab_rollout.sql

ALTER TABLE newsletter_campaigns
  ADD COLUMN IF NOT EXISTS ab_winner_variant CHAR(1) CHECK (ab_winner_variant IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS ab_rollout_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS newsletter_link_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID NOT NULL UNIQUE,
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES newsletter_campaign_recipients(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  variant_key CHAR(1) NOT NULL CHECK (variant_key IN ('A', 'B')),
  destination_url TEXT NOT NULL,
  product_slug VARCHAR(255),
  link_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clicked_at TIMESTAMP WITH TIME ZONE,
  click_count INTEGER NOT NULL DEFAULT 0,
  clicked_ip VARCHAR(120),
  clicked_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_link_events_campaign
  ON newsletter_link_events(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_link_events_clicked
  ON newsletter_link_events(campaign_id, clicked_at)
  WHERE clicked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS newsletter_conversion_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  link_event_id UUID NOT NULL REFERENCES newsletter_link_events(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  product_slug VARCHAR(255),
  order_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  attributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, link_event_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_conversion_events_campaign
  ON newsletter_conversion_events(campaign_id, attributed_at DESC);

INSERT INTO newsletter_settings (setting_key, setting_value, description)
VALUES
  ('ab_auto_winner_min_sample', '80', 'Minimum sent recipient sample before auto winner selection'),
  ('ab_auto_winner_min_delta', '0.01', 'Minimum CTR delta required to auto-select a winner')
ON CONFLICT (setting_key) DO NOTHING;
