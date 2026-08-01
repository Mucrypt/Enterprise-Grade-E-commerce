-- Refund/cancellation consistency fixes.
--
-- payments.status has no 'partially_refunded' value, but createRefund
-- (payment.controller.ts) has always tried to set it to exactly that for
-- any refund smaller than the full order amount -- meaning a partial
-- refund crashes with a CHECK-constraint violation *after* Stripe has
-- already refunded the customer's money, leaving our own records out of
-- sync with what actually happened. orders.payment_status already allows
-- 'partially_refunded' (001_initial_schema.sql); payments.status did not.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'partially_refunded'
));
