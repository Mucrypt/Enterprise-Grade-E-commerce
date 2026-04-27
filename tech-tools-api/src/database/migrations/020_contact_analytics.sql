-- =====================================================
-- CONTACT ANALYTICS SCHEMA
-- Tracks hybrid contact policy funnel events
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(60) NOT NULL,     -- 'guest_contact_cta_click' | 'protected_contact_login_redirect'
    subject VARCHAR(60),                 -- selected form subject at time of event (nullable for CTA clicks)
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_analytics_event_type ON contact_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_contact_analytics_created_at  ON contact_analytics(created_at);
