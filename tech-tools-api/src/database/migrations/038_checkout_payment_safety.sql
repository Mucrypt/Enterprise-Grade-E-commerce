-- Checkout/payment safety fixes.
-- See docs/PRODUCTION-READINESS-AUDIT.md and the checkout-session redesign
-- that creates the order before payment is attempted, prices from the
-- database, charges Stripe in EUR, and dedupes webhook side effects.

-- This is an Italy-based business: new orders should default to EUR, not
-- USD. Existing rows are left untouched -- this only changes the default
-- applied to future inserts that don't specify a currency explicitly.
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'EUR';

-- Tracks whether the order-confirmation email/WhatsApp notification has
-- already been sent for this order, so the payment-succeeded webhook
-- (the confirmation trigger for the new checkout-session flow, since order
-- creation now happens before payment) never double-sends for an order
-- whose confirmation was already dispatched inline by the legacy
-- createOrder/createGuestOrder path (still used by the mobile app, which
-- creates orders only after payment already succeeded).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE;
