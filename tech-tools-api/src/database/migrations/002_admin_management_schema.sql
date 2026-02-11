-- =====================================================
-- Admin Management Schema - Enterprise Security
-- =====================================================

-- Admin Activity Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_resource_type ON admin_activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_logs(created_at);

-- Admin Permissions (Granular Access Control)
CREATE TABLE IF NOT EXISTS admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    actions TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin Role Permissions (Many-to-Many)
CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

-- Admin Invitations (Secure Admin Creation)
CREATE TABLE IF NOT EXISTS admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'super_admin')),
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires_at ON admin_invitations(expires_at);

-- Admin Sessions (Track Admin Login Sessions)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Admin Two Factor Authentication
CREATE TABLE IF NOT EXISTS admin_two_factor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    backup_codes TEXT[],
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Insert Default Admin Permissions
-- =====================================================

INSERT INTO admin_permissions (name, description, resource, actions) VALUES
-- User Management
('manage_users', 'Full user management access', 'users', ARRAY['create', 'read', 'update', 'delete', 'list']),
('view_users', 'View user information', 'users', ARRAY['read', 'list']),

-- Product Management
('manage_products', 'Full product management access', 'products', ARRAY['create', 'read', 'update', 'delete', 'list']),
('view_products', 'View products', 'products', ARRAY['read', 'list']),

-- Category Management
('manage_categories', 'Full category management access', 'categories', ARRAY['create', 'read', 'update', 'delete', 'list']),
('view_categories', 'View categories', 'categories', ARRAY['read', 'list']),

-- Order Management
('manage_orders', 'Full order management access', 'orders', ARRAY['create', 'read', 'update', 'delete', 'list', 'refund']),
('view_orders', 'View orders', 'orders', ARRAY['read', 'list']),
('process_orders', 'Process and update orders', 'orders', ARRAY['read', 'update', 'list']),

-- Payment Management
('manage_payments', 'Full payment management access', 'payments', ARRAY['read', 'list', 'refund']),
('view_payments', 'View payment information', 'payments', ARRAY['read', 'list']),

-- Supplier Management
('manage_suppliers', 'Full supplier management access', 'suppliers', ARRAY['create', 'read', 'update', 'delete', 'list', 'sync']),
('view_suppliers', 'View supplier information', 'suppliers', ARRAY['read', 'list']),

-- Admin Management (Super Admin Only)
('manage_admins', 'Manage admin users', 'admins', ARRAY['create', 'read', 'update', 'delete', 'list', 'invite']),
('view_admins', 'View admin information', 'admins', ARRAY['read', 'list']),

-- Analytics & Reports
('view_analytics', 'View analytics and reports', 'analytics', ARRAY['read']),
('export_reports', 'Export reports', 'analytics', ARRAY['read', 'export']),

-- System Settings (Super Admin Only)
('manage_settings', 'Manage system settings', 'settings', ARRAY['read', 'update']),
('view_logs', 'View system and admin logs', 'logs', ARRAY['read', 'list'])

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Assign Permissions to Roles
-- =====================================================

-- Super Admin: Full Access
INSERT INTO admin_role_permissions (role, permission_id)
SELECT 'super_admin', id FROM admin_permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Admin: Limited Access (No admin management, no system settings)
INSERT INTO admin_role_permissions (role, permission_id)
SELECT 'admin', id FROM admin_permissions 
WHERE name IN (
    'manage_users', 'manage_products', 'manage_categories', 
    'manage_orders', 'process_orders', 'manage_payments',
    'manage_suppliers', 'view_analytics', 'export_reports', 'view_logs'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- Add Constraints
-- =====================================================

-- Prevent users from being both customer and admin
ALTER TABLE users ADD CONSTRAINT check_user_type_valid 
CHECK (user_type IN ('customer', 'admin', 'super_admin'));

-- Add admin-specific columns if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='last_login_at') THEN
        ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='last_login_ip') THEN
        ALTER TABLE users ADD COLUMN last_login_ip INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='failed_login_attempts') THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='locked_until') THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='two_factor_enabled') THEN
        ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- =====================================================
-- Create Functions for Admin Logging
-- =====================================================

CREATE OR REPLACE FUNCTION log_admin_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-log admin actions
    IF NEW.user_type IN ('admin', 'super_admin') THEN
        -- Logic can be extended based on specific actions
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_email_user_type ON users(email, user_type);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE admin_activity_logs IS 'Audit trail for all admin actions';
COMMENT ON TABLE admin_permissions IS 'Granular permission definitions';
COMMENT ON TABLE admin_role_permissions IS 'Permission assignments to roles';
COMMENT ON TABLE admin_invitations IS 'Secure admin invitation system';
COMMENT ON TABLE admin_sessions IS 'Track active admin sessions';
COMMENT ON TABLE admin_two_factor IS 'Two-factor authentication for admins';
