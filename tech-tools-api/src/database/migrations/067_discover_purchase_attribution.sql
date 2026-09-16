-- Idempotency guard for discover_posts.purchase_count. Stripe webhooks can
-- retry handlePaymentSucceeded for the same order (documented in
-- stripe.service.ts's own comments on the affiliate-attribution path,
-- which uses the identical INSERT-guard pattern) -- without this, a
-- retried webhook would double-count a purchase in the ranking formula.
-- Only incremented once per (order, discover_post_id) pair, ever.
CREATE TABLE IF NOT EXISTS discover_purchase_attributions (
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    discover_post_id UUID NOT NULL REFERENCES discover_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id, discover_post_id)
);
