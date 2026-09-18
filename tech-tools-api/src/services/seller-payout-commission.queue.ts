/**
 * Seller payout confirmation worker. Same shape as
 * affiliate-commission.queue.ts (this codebase's one consistent
 * async-worker convention -- a plain setInterval poller, module-level
 * start/stop + a re-entrancy guard, no separate queue infrastructure).
 *
 * Same known limitation as every other worker in this codebase
 * (affiliate-commission.queue.ts, promotion-campaign.queue.ts,
 * newsletter.queue.ts, workers/anomaly.detection.ts): no
 * `FOR UPDATE SKIP LOCKED` -- safety against double-processing rests on
 * the single-process assumption (one Node process running this worker)
 * plus the queueBusy re-entrancy guard, not row-level locking.
 * SELLER_PAYOUT_QUEUE_ENABLED (default true) exists as the same explicit
 * safety valve as AFFILIATE_QUEUE_ENABLED, for if production topology
 * ever moves to multiple replicas.
 *
 * Each tick does three things, in order:
 *  1. Confirms 'pending' earnings whose order is safely past return/
 *     refund risk -- per-tier hold period (seller_tier_config.
 *     payout_hold_period_days), not one global period like the
 *     affiliate program, since migration 034's seed data already
 *     promised faster payouts for more trusted tiers.
 *  2. Claws back earnings whose order was refunded AFTER confirmation --
 *     including ones already marked 'paid' (a deliberate difference
 *     from the affiliate worker, which only claws back 'confirmed'
 *     store credit): a manual bank-transfer payout is real money that
 *     has already left the business and cannot be silently reversed the
 *     way an unspent internal credit can, so a late refund on an already
 *     -paid earning still needs a real, visible record (clawed_back_at +
 *     a negative ledger row) even though the earning's own status stays
 *     'paid' to preserve the historical fact "this was part of payout
 *     batch X".
 *  3. Cancels 'pending' earnings whose order was refunded BEFORE ever
 *     confirming -- no ledger reversal needed, since nothing was ever
 *     issued.
 */
import { query } from '../database/connection'
import logger from '../utils/logger'
import { NotificationService } from './notification.service'
import { getSellerPayoutSettings, isSellerPayoutsEnabled } from './seller-payout.service'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(
  process.env.SELLER_PAYOUT_QUEUE_INTERVAL_MS || String(60 * 60 * 1000), // hourly -- payout timing is measured in days, not seconds
  10,
)

function isQueueEnabled(): boolean {
  return process.env.SELLER_PAYOUT_QUEUE_ENABLED !== 'false'
}

async function confirmEligibleSellerEarnings(): Promise<number> {
  const settings = await getSellerPayoutSettings()
  const result = await query(
    `SELECT se.id, se.seller_net_amount, sp.user_id AS seller_user_id
     FROM seller_earnings se
     JOIN orders o ON o.id = se.order_id
     JOIN seller_profiles sp ON sp.id = se.seller_profile_id
     JOIN seller_tier_config tc ON tc.tier = se.seller_tier_snapshot
     WHERE se.status = 'pending'
       AND o.order_status NOT IN ('cancelled', 'refunded')
       AND o.payment_status NOT IN ('refunded', 'partially_refunded', 'cancelled')
       AND (
         (o.order_status = 'delivered' AND o.actual_delivery_date <= CURRENT_DATE - tc.payout_hold_period_days)
         OR (o.order_status != 'delivered' AND o.created_at <= NOW() - ($1 || ' days')::interval)
       )
     LIMIT 200`,
    [settings.fallbackHoldPeriodDays],
  )

  for (const row of result.rows) {
    await query(
      `UPDATE seller_earnings SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
      [row.id],
    )
    await query(
      `INSERT INTO seller_payout_ledger (seller_profile_id, delta_amount, reason, reference_type, reference_id)
       SELECT seller_profile_id, $2, 'earning_confirmed', 'seller_earning', $1
       FROM seller_earnings WHERE id = $1`,
      [row.id, row.seller_net_amount],
    )
    try {
      await NotificationService.create({
        userId: row.seller_user_id,
        type: 'seller_earning_confirmed',
        title: 'Sale earnings confirmed',
        message: `${Number(row.seller_net_amount).toFixed(2)} from a recent sale is now confirmed and ready for payout.`,
        sendEmail: true,
        data: { earningId: row.id, amount: row.seller_net_amount },
      })
    } catch (notifyError) {
      // Never let a notification failure block earnings confirmation --
      // the money movement above already committed.
      logger.warn('Failed to notify seller of confirmed earnings:', notifyError)
    }
  }
  return result.rows.length
}

async function clawBackLateRefunds(): Promise<number> {
  const result = await query(
    `SELECT se.id, se.seller_net_amount, se.status, se.seller_profile_id
     FROM seller_earnings se
     JOIN orders o ON o.id = se.order_id
     WHERE se.status IN ('confirmed', 'paid')
       AND se.clawed_back_at IS NULL
       AND (o.order_status IN ('cancelled', 'refunded') OR o.payment_status IN ('refunded', 'partially_refunded', 'cancelled'))
     LIMIT 200`,
  )

  for (const row of result.rows) {
    if (row.status === 'confirmed') {
      await query(
        `UPDATE seller_earnings
         SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = 'order_refunded_after_confirmation'
         WHERE id = $1`,
        [row.id],
      )
    } else {
      // status === 'paid' -- real money already left the business via a
      // payout batch. Status intentionally stays 'paid' (see file header);
      // clawed_back_at is the only status-like signal this ever happened.
      await query(
        `UPDATE seller_earnings SET clawed_back_at = NOW() WHERE id = $1`,
        [row.id],
      )
    }
    // Known limitation, same as the affiliate worker's identical one: if
    // the seller's balance goes negative here, it's recovered from their
    // next payout -- no collections flow exists yet.
    await query(
      `INSERT INTO seller_payout_ledger (seller_profile_id, delta_amount, reason, reference_type, reference_id)
       VALUES ($1, $2, 'earning_clawback', 'seller_earning', $3)`,
      [row.seller_profile_id, -Math.abs(row.seller_net_amount), row.id],
    )
  }
  return result.rows.length
}

async function cancelPendingRefundedOrders(): Promise<number> {
  const result = await query(
    `UPDATE seller_earnings se
     SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = 'order_refunded_before_confirmation'
     FROM orders o
     WHERE o.id = se.order_id
       AND se.status = 'pending'
       AND (o.order_status IN ('cancelled', 'refunded') OR o.payment_status IN ('refunded', 'partially_refunded', 'cancelled'))
     RETURNING se.id`,
  )
  return result.rows.length
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true
  try {
    if (!(await isSellerPayoutsEnabled())) return
    const confirmed = await confirmEligibleSellerEarnings()
    const clawedBack = await clawBackLateRefunds()
    const cancelledEarly = await cancelPendingRefundedOrders()
    if (confirmed || clawedBack || cancelledEarly) {
      logger.info(
        `[SellerPayoutCommissionQueue] confirmed=${confirmed} clawedBack=${clawedBack} cancelledBeforeConfirm=${cancelledEarly}`,
      )
    }
  } catch (error) {
    logger.error('[SellerPayoutCommissionQueue] Tick failed:', error)
  } finally {
    queueBusy = false
  }
}

export function startSellerPayoutCommissionWorker(): void {
  if (queueStarted) return
  if (!isQueueEnabled()) {
    logger.info('[SellerPayoutCommissionQueue] SELLER_PAYOUT_QUEUE_ENABLED=false -- this instance will not run payout confirmation.')
    return
  }
  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(60_000, WORKER_INTERVAL_MS))
  void processQueueTick()
  logger.info(`[SellerPayoutCommissionQueue] Worker started (interval=${Math.max(60_000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopSellerPayoutCommissionWorker(): void {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}
