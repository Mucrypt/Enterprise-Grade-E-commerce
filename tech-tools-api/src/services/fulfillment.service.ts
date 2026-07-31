import { query } from '../database/connection'

/**
 * Resolves which supplier should fulfill an order line item, preferring the
 * offer marked primary, then falling back to the cheapest available offer.
 * Returns null for first-party/admin-stocked products with no supplier offer —
 * that must not block order creation.
 */
export async function resolveSupplierForOrderItem(
  productId: string,
): Promise<string | null> {
  const result = await query(
    `SELECT supplier_id
     FROM supplier_products
     WHERE product_id = $1
       AND is_available = true
     ORDER BY is_primary DESC, cost_price ASC
     LIMIT 1`,
    [productId],
  )

  return result.rows[0]?.supplier_id ?? null
}
