-- =====================================================
-- User Devices (Push Notification Tokens)
-- Version: 062
-- Description: Real device/push-token storage -- the mobile app already
--              has a full Expo push-token client (requests permission,
--              retrieves a token, POSTs it to the backend) but the
--              backend endpoint and this table never existed, so every
--              registration attempt has been silently failing.
--              NotificationService.sendPushNotification() already
--              queries `user_devices` (copy-pasted from a design that
--              assumed this table existed) -- this migration makes that
--              query real.
-- =====================================================




CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    push_token TEXT,
    platform VARCHAR(20),
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id) WHERE push_token IS NOT NULL;

CREATE OR REPLACE FUNCTION update_user_devices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_devices_timestamp ON user_devices;
CREATE TRIGGER trigger_update_user_devices_timestamp
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_user_devices_timestamp();

-- =====================================================
-- Abandoned Checkout Recovery -- tracks whether a stalled, unpaid order
-- has already been sent a recovery nudge, so the worker never re-emails
-- the same order on every tick.
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMP;

-- New notification type for the recovery nudge (see notification_types
-- seed in migration 004) -- same idempotent insert pattern.
INSERT INTO notification_types (key, name, description, icon, color) VALUES
('abandoned_checkout', 'Abandoned Checkout', 'A started order was never completed', 'ShoppingCart', 'orange')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE user_devices IS 'Registered push-notification tokens (Expo) per user device';
COMMENT ON COLUMN orders.recovery_email_sent_at IS 'When the abandoned-checkout recovery nudge was sent, if ever -- NULL means not yet sent';
