-- Guest Checkout Support
-- Allows users to checkout without creating an account

-- Add guest_email and guest_name columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS guest_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS guest_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(20);

-- Create guest_checkouts table for tracking guest orders
CREATE TABLE IF NOT EXISTS guest_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  checkout_token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
  verified_at TIMESTAMP WITH TIME ZONE,
  created_by_ip VARCHAR(45)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_checkouts_email ON guest_checkouts(email);
CREATE INDEX IF NOT EXISTS idx_guest_checkouts_token ON guest_checkouts(checkout_token);
CREATE INDEX IF NOT EXISTS idx_guest_checkouts_order_id ON guest_checkouts(order_id);

-- Create index for orders with guest emails
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email) WHERE guest_email IS NOT NULL;

-- Add comment documenting guest checkout
COMMENT ON TABLE guest_checkouts IS 'Tracks guest checkout sessions and orders for customers without accounts';
COMMENT ON COLUMN guest_checkouts.checkout_token IS 'Token used to retrieve guest order without authentication';
