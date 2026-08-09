-- =====================================================
-- REPAIR: unified analytics `alerts` table
-- =====================================================
-- 026_unified_analytics_schema.sql defined an `alerts` table whose
-- acknowledged_by column referenced a table that has never existed in this
-- codebase (`admins`) -- admin-ness has always lived on `users.user_type`
-- (see 002_admin_management_schema.sql), and every other admin-actor FK in
-- the schema already reflects that (e.g. 027_notification_preferences.sql:
-- admin_notification_preferences.admin_id REFERENCES users(id)).
--
-- Per docs/PRODUCTION-026-DRIFT-RECONCILIATION.md: production has
-- 026_unified_analytics_schema.sql marked executed in schema_migrations,
-- and does have the other three tables that migration creates
-- (user_sessions, events_core, event_aggregates_hourly) -- but does not
-- have `alerts`, and does not have `admins`. Because the tracked migration
-- runner (src/database/migrate.ts) only checks by filename, a filename
-- already marked executed is never re-run, so simply fixing 026 in place
-- would never reach production -- and rewriting an already-applied
-- migration file is exactly the discipline problem this repair avoids.
-- This migration is additive-only and does not touch 026 or any other
-- already-applied migration.
--
-- `alerts` is not unused scaffolding: the anomaly-detection worker
-- (src/workers/anomaly.detection.ts, running every 15 minutes) writes to
-- it and silently fails (and silently fails to notify admins) without it;
-- the /api/v1/alerts REST API and the real-time "alert-acknowledged"
-- Socket.io broadcast both depend on it too.
--
-- Idempotent: every statement uses IF NOT EXISTS (or an equivalent guard
-- for CREATE TYPE, which has no IF NOT EXISTS form of its own), matching
-- the rest of this codebase's migration style, so re-running this file
-- (e.g. against an environment where it partially applied) is safe.
--
-- alert_severity_enum (defined by 026) almost certainly still exists in
-- production even though the `alerts` table that used it doesn't --
-- dropping a table does not drop a type its column referenced -- but this
-- couldn't be confirmed via a read-only check ahead of writing this file,
-- so its creation is guarded rather than assumed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity_enum') THEN
    CREATE TYPE alert_severity_enum AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL,
    severity alert_severity_enum NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    current_value DECIMAL(12, 2),
    threshold_value DECIMAL(12, 2),
    baseline_value DECIMAL(12, 2),

    -- Context
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    -- Fixed from 026's `REFERENCES admins(id)` -- acknowledged_by is
    -- always populated from req.user.id (a users.id) in
    -- alerts.controller.ts, so admins(id) could never have been correct.
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resource ON alerts(resource_type, resource_id);

COMMENT ON TABLE alerts IS 'Anomaly detection alerts triggered by thresholds and patterns';
