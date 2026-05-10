-- ============================================================
-- Migration 021: AI Communication Orchestrator
-- Production-grade AI agent for omnichannel communications
-- ============================================================

-- Enum types
DO $$ BEGIN
  CREATE TYPE ai_channel AS ENUM ('email', 'whatsapp', 'newsletter', 'contact_reply');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_draft_status AS ENUM ('pending', 'approved', 'rejected', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_action_type AS ENUM (
    'draft_generated',
    'draft_approved',
    'draft_rejected',
    'draft_sent',
    'draft_failed',
    'customer_analyzed',
    'campaign_generated',
    'timeline_viewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- AI Drafts: human-in-the-loop approval queue
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         ai_channel NOT NULL,
  status          ai_draft_status NOT NULL DEFAULT 'pending',

  -- Targeting
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),
  recipient_name  VARCHAR(255),
  customer_id     UUID,                   -- references users(id) if known
  contact_id      UUID,                   -- references contact_submissions(id) if applicable

  -- Content
  subject         TEXT,
  body_html       TEXT,
  body_text       TEXT NOT NULL,

  -- AI metadata
  prompt          TEXT NOT NULL,          -- original admin prompt
  model_name      VARCHAR(100) NOT NULL,
  model_version   VARCHAR(50),
  token_usage     JSONB DEFAULT '{}',     -- {prompt_tokens, completion_tokens, total_tokens}
  confidence      SMALLINT CHECK (confidence BETWEEN 0 AND 100),

  -- Lifecycle
  created_by      UUID NOT NULL,          -- admin user id
  approved_by     UUID,
  rejected_by     UUID,
  sent_at         TIMESTAMPTZ,
  reject_reason   TEXT,

  -- Optional: scheduled delivery
  scheduled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI Audit Log: immutable record of all AI interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          ai_action_type NOT NULL,
  actor_id        UUID NOT NULL,          -- admin user who triggered
  draft_id        UUID REFERENCES ai_drafts(id) ON DELETE SET NULL,
  channel         ai_channel,
  customer_id     UUID,
  meta            JSONB DEFAULT '{}',     -- extra context
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Communication Timeline: unified per-customer message history
-- ============================================================
CREATE TABLE IF NOT EXISTS communication_timeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL,          -- references users(id)
  customer_email  VARCHAR(255),
  customer_phone  VARCHAR(50),

  channel         ai_channel NOT NULL,
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject         TEXT,
  body_preview    TEXT,                   -- first 500 chars
  body_full       TEXT,

  -- Source reference (one will be set)
  email_id        UUID,                   -- references email_messages(id)
  whatsapp_id     UUID,                   -- references whatsapp_messages(id)
  contact_id      UUID,                   -- references contact_submissions(id)
  newsletter_id   UUID,                   -- references newsletter_campaigns(id)
  ai_draft_id     UUID REFERENCES ai_drafts(id) ON DELETE SET NULL,

  status          VARCHAR(50) DEFAULT 'delivered',
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance at scale
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status         ON ai_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_channel        ON ai_drafts(channel);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created_by     ON ai_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_customer_id    ON ai_drafts(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created_at     ON ai_drafts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_audit_actor           ON ai_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_draft_id        ON ai_audit_log(draft_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_customer_id     ON ai_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created_at      ON ai_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_timeline_customer   ON communication_timeline(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_timeline_email      ON communication_timeline(customer_email);
CREATE INDEX IF NOT EXISTS idx_comm_timeline_channel    ON communication_timeline(channel);
CREATE INDEX IF NOT EXISTS idx_comm_timeline_created_at ON communication_timeline(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_drafts_updated_at ON ai_drafts;
CREATE TRIGGER trg_ai_drafts_updated_at
  BEFORE UPDATE ON ai_drafts
  FOR EACH ROW EXECUTE FUNCTION update_ai_drafts_updated_at();
