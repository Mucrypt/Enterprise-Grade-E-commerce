/**
 * MIGRATION: Add notification preferences and alert thresholds tables
 * Enables admin-specific notification configuration
 */

-- Admin Notification Preferences Table
CREATE TABLE IF NOT EXISTS admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email notifications
  email_enabled BOOLEAN DEFAULT true,
  email_address VARCHAR(255),
  
  -- Slack notifications
  slack_enabled BOOLEAN DEFAULT false,
  slack_channel VARCHAR(255),
  
  -- SMS notifications
  sms_enabled BOOLEAN DEFAULT false,
  phone_number VARCHAR(20),
  
  -- Severity threshold (only receive alerts at or above this level)
  severity_threshold VARCHAR(20) DEFAULT 'high',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_admin_prefs UNIQUE (admin_id),
  CONSTRAINT valid_severity CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low'))
);

-- Alert Thresholds Table
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_type VARCHAR(100) NOT NULL UNIQUE,
  threshold_value NUMERIC(10, 2) NOT NULL,
  baseline_value NUMERIC(10, 2),
  unit VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'high',
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_threshold_type CHECK (threshold_type IN (
    'revenue_drop',
    'refund_rate',
    'return_rate',
    'checkout_abandonment',
    'search_zero_results',
    'supplier_late_rate'
  )),
  CONSTRAINT valid_severity_threshold CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

-- Indexes
CREATE INDEX idx_admin_notification_prefs_admin_id ON admin_notification_preferences(admin_id);
CREATE INDEX idx_alert_thresholds_type ON alert_thresholds(threshold_type);
CREATE INDEX idx_alert_thresholds_active ON alert_thresholds(is_active);

-- Insert default thresholds
INSERT INTO alert_thresholds (threshold_type, threshold_value, unit, severity, description)
VALUES
  ('revenue_drop', 20, '%', 'high', 'Alert when daily revenue drops 20% below 7-day average'),
  ('refund_rate', 5, '%', 'high', 'Alert when refund rate exceeds 5% in 24 hours'),
  ('return_rate', 3, '%', 'medium', 'Alert when return rate exceeds 3% in 24 hours'),
  ('checkout_abandonment', 40, '%', 'medium', 'Alert when checkout abandonment rate exceeds 40%'),
  ('search_zero_results', 10, '%', 'medium', 'Alert when 10%+ of searches return zero results'),
  ('supplier_late_rate', 10, '%', 'high', 'Alert when supplier delivery late rate exceeds 10%')
ON CONFLICT DO NOTHING;
