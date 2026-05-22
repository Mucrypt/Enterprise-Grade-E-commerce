import { query } from '../database/connection'
import logger from '../utils/logger'

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) AS regclass`, [
    `public.${tableName}`,
  ])

  return Boolean(result.rows[0]?.regclass)
}

export const grantEntitlementsForPaidOrder = async (orderId: string) => {
  const hasEntitlementTable = await tableExists('digital_entitlements')
  if (!hasEntitlementTable) {
    logger.warn('digital_entitlements table does not exist; skipping grants', {
      orderId,
    })
    return { granted: 0, skipped: 0 }
  }

  const orderResult = await query(
    `SELECT id, user_id, payment_status
     FROM orders
     WHERE id = $1
     LIMIT 1`,
    [orderId],
  )

  if (orderResult.rows.length === 0) {
    logger.warn('Order not found for entitlement grant', { orderId })
    return { granted: 0, skipped: 0 }
  }

  const order = orderResult.rows[0]

  if (!order.user_id) {
    logger.info('Guest order detected; entitlement grant skipped', { orderId })
    return { granted: 0, skipped: 0 }
  }

  if (order.payment_status !== 'paid') {
    logger.info('Order not paid; entitlement grant skipped', {
      orderId,
      paymentStatus: order.payment_status,
    })
    return { granted: 0, skipped: 0 }
  }

  const digitalItemsResult = await query(
    `SELECT
       oi.id AS order_item_id,
       oi.product_id,
       p.product_kind,
       p.is_digital
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
       AND (
         p.product_kind IN ('book', 'digital', 'digital_book', 'digital_bundle')
         OR p.is_digital = true
       )`,
    [orderId],
  )

  let granted = 0
  let skipped = 0

  for (const item of digitalItemsResult.rows) {
    const insertResult = await query(
      `INSERT INTO digital_entitlements (
         order_id, order_item_id, user_id, product_id, license_type,
         granted_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        orderId,
        item.order_item_id,
        order.user_id,
        item.product_id,
        item.product_kind === 'digital_bundle' ? 'bundle' : 'standard',
      ],
    )

    if (insertResult.rows.length > 0) {
      granted++
    } else {
      skipped++
    }
  }

  logger.info('Digital entitlement grant completed', {
    orderId,
    granted,
    skipped,
  })

  return { granted, skipped }
}

export default {
  grantEntitlementsForPaidOrder,
}