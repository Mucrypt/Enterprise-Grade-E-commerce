-- =====================================================
-- STAFF MEMBERSHIPS (MARKET-OPS-1 foundation)
-- =====================================================
-- Additive staff/role system, independent of users.user_type. A user keeps
-- whatever user_type they already have (almost always 'customer') and
-- separately holds zero or more staff_memberships rows granting scoped
-- operational access. This is deliberate: the existing admin/super_admin
-- model (users.user_type + authorize()) continues to work completely
-- unmodified -- this table is read by new, additive middleware
-- (requireStaff/requirePermission) only, never by authorize().
--
-- Design rationale (from docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md and the
-- Pre-Implementation review in docs/GLOBAL-COMMERCE-ARCHITECTURE.md):
-- market_scope stays a plain TEXT[] of ISO country codes for now, not a
-- normalized join table -- there is no `countries` table yet for it to
-- reference (Global Commerce work is explicitly deferred), and TEXT[] is
-- trivially forward-compatible: a future migration can add a normalized
-- staff_market_scopes table and backfill it from this column without
-- touching this one.

CREATE TYPE staff_role AS ENUM (
    'OWNER',
    'SUPER_ADMIN',
    'ADMIN',
    'MARKET_MANAGER',
    'CATALOG_MANAGER',
    'ORDER_MANAGER',
    'MARKETING_MANAGER',
    'SUPPORT_AGENT'
);

CREATE TYPE staff_membership_status AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE IF NOT EXISTS staff_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role staff_role NOT NULL,
    -- NULL = global scope (no market restriction). A non-null array is
    -- ISO 3166-1 alpha-2 country codes this membership is restricted to,
    -- e.g. ARRAY['CM'] or ARRAY['US','CA'] -- including an explicitly
    -- empty array, ARRAY[]::TEXT[], which means "restricted to no
    -- countries" (fails closed) and is intentionally NOT equivalent to
    -- NULL. See applyMarketScope() in src/middleware/staff.ts.
    market_scope TEXT[] DEFAULT NULL,
    status staff_membership_status NOT NULL DEFAULT 'ACTIVE',
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    suspended_at TIMESTAMPTZ,
    suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user may hold multiple different roles (multiple rows), but at most one
-- non-revoked (ACTIVE or SUSPENDED) grant of the *same* role at a time.
-- REVOKED is terminal and frees the slot for a fresh grant of that role
-- later -- a plain UNIQUE(user_id, role) would wrongly block re-granting a
-- role after a past revocation.
CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_memberships_user_role_current
    ON staff_memberships (user_id, role)
    WHERE status IN ('ACTIVE', 'SUSPENDED');

CREATE INDEX IF NOT EXISTS idx_staff_memberships_user_id ON staff_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_memberships_status ON staff_memberships(status);
CREATE INDEX IF NOT EXISTS idx_staff_memberships_role ON staff_memberships(role);

COMMENT ON TABLE staff_memberships IS 'Additive staff role grants, independent of users.user_type. See docs/MARKET-OPS-STAFF-ACCESS-AUDIT.md.';
COMMENT ON COLUMN staff_memberships.market_scope IS 'NULL = global. Non-null (including an empty array) = ISO alpha-2 country codes this grant is restricted to; an empty array restricts to no countries rather than being treated as global.';

-- =====================================================
-- STAFF AUDIT LOG
-- =====================================================
-- Immutable (by convention -- no application code ever issues an UPDATE
-- against this table, matching the pattern already used for
-- order_commerce_snapshots in docs/GLOBAL-COMMERCE-ARCHITECTURE.md).
-- Never stores passwords, JWTs, refresh tokens, API keys, or payment
-- credentials -- metadata is restricted at the application layer to
-- operational context only (see staff.controller.ts).

CREATE TABLE IF NOT EXISTS staff_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_membership_id UUID REFERENCES staff_memberships(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    -- Denormalized alongside staff_membership_id so the log stays
    -- queryable/meaningful even if the membership row itself is later
    -- deleted (ON DELETE SET NULL above never happens today since nothing
    -- deletes staff_memberships rows, but this keeps the log honest if
    -- that ever changes).
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_log_staff_membership_id ON staff_audit_log(staff_membership_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_actor_user_id ON staff_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_target_user_id ON staff_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_action ON staff_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_staff_audit_log_created_at ON staff_audit_log(created_at DESC);

COMMENT ON TABLE staff_audit_log IS 'Immutable audit trail for staff_memberships grants/suspensions/revocations/role changes/scope changes/denied access attempts. Never write credentials/tokens here.';
