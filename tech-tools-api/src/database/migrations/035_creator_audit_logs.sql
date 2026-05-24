-- ============================================================
-- Migration 035: Creator Audit Logs
-- Immutable audit trail for all creator-initiated mutations
-- (price changes, status transitions, product updates)
-- ============================================================

CREATE TABLE IF NOT EXISTS creator_audit_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_profile_id UUID    NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action         VARCHAR(100) NOT NULL,
  entity_type    VARCHAR(50)  NOT NULL DEFAULT 'book',
  entity_id      UUID,
  old_value      JSONB,
  new_value      JSONB,
  meta           JSONB,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutability: disallow UPDATE and DELETE on this table
CREATE OR REPLACE RULE no_update_creator_audit AS
  ON UPDATE TO creator_audit_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_creator_audit AS
  ON DELETE TO creator_audit_logs DO INSTEAD NOTHING;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_creator_audit_creator
  ON creator_audit_logs(creator_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_audit_entity
  ON creator_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_creator_audit_action
  ON creator_audit_logs(action, created_at DESC);
