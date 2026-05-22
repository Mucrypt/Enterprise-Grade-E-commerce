-- Ensure entitlement grants are idempotent across webhook retries.

CREATE UNIQUE INDEX IF NOT EXISTS idx_digital_entitlements_unique_order_item
  ON digital_entitlements(order_item_id)
  WHERE order_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_digital_entitlements_unique_user_product_order
  ON digital_entitlements(user_id, product_id, order_id)
  WHERE order_id IS NOT NULL;