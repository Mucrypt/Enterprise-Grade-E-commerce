-- Live visitor analytics: geo-location on sessions + missing event types.
-- Additive and backward-compatible: existing events_core/user_sessions rows are unaffected.
--
-- Note: ALTER TYPE ... ADD VALUE is safe inside this migration's transaction because
-- this file only adds enum values/columns/indexes -- it does not read or write any row
-- using the new enum values. The application only starts using them in later, separate
-- transactions once this migration has committed.

ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'page_view';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'error';

-- Lean geo columns -- country/city only, no lat/long needed for a country breakdown table.
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country_code CHAR(2);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS city VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_sessions_country_code ON user_sessions(country_code);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity_time ON user_sessions(last_activity_time);
CREATE INDEX IF NOT EXISTS idx_user_sessions_utm_source ON user_sessions(utm_source);
