import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { getClient, query } from '../../../database/connection'
import logger from '../../../utils/logger'

// =====================================================
// Admin: seller earnings & manual payouts -- kept as its own file
// separate from admin/sellers.controller.ts (which is scoped to trust &
// safety: verification/suspension), since this is a distinct money
// domain gated by its own sellers.payouts.view/manage permissions
// (staff-permissions.config.ts), not the plain admin/super_admin check
// the verification queue uses.
//
// A seller's live unpaid balance is always computed from
// seller_payout_ledger (SUM(delta_amount)) -- never a cached rollup
// column, same principle as store_credit_ledger.
// =====================================================

export const getSellerPayoutBalances = async (req: AuthRequest, res: Response) => {
  try {
    const owedOnly = req.query.owedOnly !== 'false'

    const result = await query(
      `SELECT
         sp.id AS seller_profile_id,
         sp.display_name,
         sp.handle,
         sp.tier,
         COALESCE(pending.pending_balance, 0) AS pending_balance,
         COALESCE(ledger.confirmed_unpaid_balance, 0) AS confirmed_unpaid_balance,
         COALESCE(ledger.lifetime_paid, 0) AS lifetime_paid
       FROM seller_profiles sp
       LEFT JOIN (
         SELECT seller_profile_id, SUM(seller_net_amount) AS pending_balance
         FROM seller_earnings WHERE status = 'pending'
         GROUP BY seller_profile_id
       ) pending ON pending.seller_profile_id = sp.id
       LEFT JOIN (
         SELECT seller_profile_id,
                SUM(delta_amount) AS confirmed_unpaid_balance,
                ABS(SUM(delta_amount) FILTER (WHERE reason = 'payout_sent')) AS lifetime_paid
         FROM seller_payout_ledger
         GROUP BY seller_profile_id
       ) ledger ON ledger.seller_profile_id = sp.id
       WHERE ${owedOnly ? 'COALESCE(ledger.confirmed_unpaid_balance, 0) > 0' : 'TRUE'}
       ORDER BY COALESCE(ledger.confirmed_unpaid_balance, 0) DESC`,
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching seller payout balances:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch seller payout balances', error: error.message })
  }
}

export const getSellerLedger = async (req: AuthRequest, res: Response) => {
  try {
    const { sellerProfileId } = req.params
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(50, parseInt(String(req.query.limit || '20'), 10))
    const offset = (page - 1) * limit

    const result = await query(
      `SELECT id, delta_amount, reason, reference_type, reference_id, created_at
       FROM seller_payout_ledger
       WHERE seller_profile_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerProfileId, limit, offset],
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching seller ledger:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch seller ledger', error: error.message })
  }
}

export const getEligibleEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { sellerProfileId } = req.params
    const result = await query(
      `SELECT se.id, se.order_id, se.gross_item_amount, se.commission_rate_snapshot,
              se.seller_net_amount, se.confirmed_at, o.order_number
       FROM seller_earnings se
       JOIN orders o ON o.id = se.order_id
       WHERE se.seller_profile_id = $1 AND se.status = 'confirmed' AND se.payout_batch_id IS NULL
       ORDER BY se.confirmed_at ASC`,
      [sellerProfileId],
    )
    res.json({ success: true, data: result.rows })
  } catch (error: any) {
    logger.error('Error fetching eligible seller earnings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch eligible earnings', error: error.message })
  }
}

/**
 * Records a real, already-sent payout (bank transfer, PayPal, etc.) as
 * one batch covering a specific, admin-selected set of confirmed
 * earnings -- explicit earningIds selection, not FIFO-by-amount, so
 * there's a real, unambiguous audit trail matching a real payment to
 * specific earnings, and a typo'd amount can never silently mark the
 * wrong earnings paid.
 */
export const recordSellerPayoutBatch = async (req: AuthRequest, res: Response) => {
  const { sellerProfileId } = req.params
  const { amount, payoutMethod, payoutReference, notes, earningIds } = req.body

  if (!Array.isArray(earningIds) || earningIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Select at least one earning to include in this payout' })
  }
  const amountNumber = Number(amount)
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return res.status(400).json({ success: false, message: 'A valid payout amount is required' })
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Lock and re-validate the exact set of earnings this payout covers
    // -- if the confirmation/clawback queue concurrently touched any of
    // them since the admin loaded the eligible-earnings list, this must
    // fail loudly rather than silently paying a stale or wrong amount.
    const earningsResult = await client.query(
      `SELECT id, seller_net_amount FROM seller_earnings
       WHERE id = ANY($1::uuid[]) AND seller_profile_id = $2 AND status = 'confirmed'
       FOR UPDATE`,
      [earningIds, sellerProfileId],
    )
    if (earningsResult.rows.length !== earningIds.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        message: 'One or more selected earnings are no longer eligible (already paid, clawed back, or belong to a different seller) -- reload and try again.',
      })
    }

    const sumOwed = earningsResult.rows.reduce((sum, row) => sum + Number(row.seller_net_amount), 0)
    if (Math.abs(sumOwed - amountNumber) > 0.01) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: `Amount (${amountNumber.toFixed(2)}) does not match the selected earnings' total (${sumOwed.toFixed(2)})`,
      })
    }

    const batchResult = await client.query(
      `INSERT INTO seller_payout_batches
        (seller_profile_id, total_amount, payout_method, payout_reference, notes, sent_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sellerProfileId, amountNumber, payoutMethod || null, payoutReference || null, notes || null, req.user?.userId],
    )
    const batch = batchResult.rows[0]

    await client.query(
      `UPDATE seller_earnings SET status = 'paid', payout_batch_id = $1, paid_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [batch.id, earningIds],
    )

    await client.query(
      `INSERT INTO seller_payout_ledger (seller_profile_id, delta_amount, reason, reference_type, reference_id)
       VALUES ($1, $2, 'payout_sent', 'seller_payout_batch', $3)`,
      [sellerProfileId, -amountNumber, batch.id],
    )

    await client.query('COMMIT')
    res.status(201).json({ success: true, message: 'Payout recorded', data: batch })
  } catch (error: any) {
    await client.query('ROLLBACK')
    logger.error('Error recording seller payout batch:', error)
    res.status(500).json({ success: false, message: 'Failed to record payout', error: error.message })
  } finally {
    client.release()
  }
}
