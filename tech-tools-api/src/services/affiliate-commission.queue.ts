/**
 * Affiliate commission confirmation worker. Same shape as
 * promotion-campaign.queue.ts (this codebase's one consistent
 * async-worker convention -- a plain setInterval poller, module-level
 * start/stop + a re-entrancy guard, no separate queue infrastructure).
 *
 * Same known limitation as every other worker in this codebase
 * (promotion-campaign.queue.ts, newsletter.queue.ts, supplier.guardrails.ts,
 * workers/anomaly.detection.ts): no `FOR UPDATE SKIP LOCKED` -- safety
 * against double-processing rests on the single-process assumption (one
 * Node process running this worker) plus the queueBusy re-entrancy guard,
 * not row-level locking. AFFILIATE_QUEUE_ENABLED (default true) exists as
 * the same explicit safety valve as PROMOTION_QUEUE_ENABLED, for if
 * production topology ever moves to multiple replicas.
 *
 * Each tick does three things, in order:
 *  1. Confirms 'pending' conversions whose order is safely past return/
 *     refund risk (the exact rule from the affiliate program plan,
 *     verified against a real throwaway Postgres instance before this
 *     file was written).
 *  2. Claws back 'confirmed' conversions whose order was refunded AFTER
 *     confirmation (a late refund) -- reverses the store credit with a
 *     negative ledger row.
 *  3. Cancels 'pending' conversions whose order was refunded BEFORE ever
 *     confirming -- no ledger reversal needed, since no credit was ever
 *     issued.
 */
import { query } from '../database/connection'
import logger from '../utils/logger'
import { NotificationService } from './notification.service'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(
  process.env.AFFILIATE_QUEUE_INTERVAL_MS || String(60 * 60 * 1000), // hourly -- commission timing is measured in days, not seconds
  10,
)

function isQueueEnabled(): boolean {
  return process.env.AFFILIATE_QUEUE_ENABLED !== 'false'
}

async function confirmEligibleConversions(): Promise<number> {
  const result = await query(
    `SELECT ac.id, ac.affiliate_id, ac.commission_amount, ap.user_id AS affiliate_user_id
     FROM affiliate_conversions ac
     JOIN orders o ON o.id = ac.order_id
     JOIN affiliate_profiles ap ON ap.id = ac.affiliate_id
     CROSS JOIN affiliate_settings s
     WHERE ac.status = 'pending'
       AND o.order_status NOT IN ('cancelled', 'refunded')
       AND o.payment_status NOT IN ('refunded', 'partially_refunded', 'cancelled')
       AND (
         (o.order_status = 'delivered' AND o.actual_delivery_date <= CURRENT_DATE - s.hold_period_days)
         OR (o.order_status != 'delivered' AND o.created_at <= NOW() - (s.fallback_hold_period_days || ' days')::interval)
       )
     LIMIT 200`,
  )

  for (const row of result.rows) {
    await query(
      `UPDATE affiliate_conversions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
      [row.id],
    )
    await query(
      `INSERT INTO store_credit_ledger (user_id, delta_amount, reason, reference_type, reference_id)
       VALUES ($1, $2, 'affiliate_commission', 'affiliate_conversion', $3)`,
      [row.affiliate_user_id, row.commission_amount, row.id],
    )
    try {
      await NotificationService.create({
        userId: row.affiliate_user_id,
        type: 'affiliate_commission_confirmed',
        title: 'Referral commission confirmed',
        message: `You've earned ${Number(row.commission_amount).toFixed(2)} in store credit from a referral purchase.`,
        sendEmail: true,
        data: { conversionId: row.id, amount: row.commission_amount },
      })
    } catch (notifyError) {
      // Never let a notification failure block commission confirmation --
      // the money movement above already committed.
      logger.warn('Failed to notify affiliate of confirmed commission:', notifyError)
    }
  }
  return result.rows.length
}

async function clawBackLateRefunds(): Promise<number> {
  const result = await query(
    `SELECT ac.id, ac.affiliate_id, ac.commission_amount, ap.user_id AS affiliate_user_id
     FROM affiliate_conversions ac
     JOIN orders o ON o.id = ac.order_id
     JOIN affiliate_profiles ap ON ap.id = ac.affiliate_id
     WHERE ac.status = 'confirmed'
       AND (o.order_status IN ('cancelled', 'refunded') OR o.payment_status IN ('refunded', 'partially_refunded', 'cancelled'))
     LIMIT 200`,
  )

  for (const row of result.rows) {
    await query(
      `UPDATE affiliate_conversions
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = 'order_refunded_after_confirmation'
       WHERE id = $1`,
      [row.id],
    )
    // Known v1 limitation (see affiliate program plan): if the affiliate
    // already spent this credit, their balance goes negative here. No
    // collections flow exists yet -- flagged as a fast-follow, not blocking.
    await query(
      `INSERT INTO store_credit_ledger (user_id, delta_amount, reason, reference_type, reference_id)
       VALUES ($1, $2, 'affiliate_commission_clawback', 'affiliate_conversion', $3)`,
      [row.affiliate_user_id, -Math.abs(row.commission_amount), row.id],
    )
  }
  return result.rows.length
}

async function cancelPendingRefundedOrders(): Promise<number> {
  const result = await query(
    `UPDATE affiliate_conversions ac
     SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = 'order_refunded_before_confirmation'
     FROM orders o
     WHERE o.id = ac.order_id
       AND ac.status = 'pending'
       AND (o.order_status IN ('cancelled', 'refunded') OR o.payment_status IN ('refunded', 'partially_refunded', 'cancelled'))
     RETURNING ac.id`,
  )
  return result.rows.length
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true
  try {
    const confirmed = await confirmEligibleConversions()
    const clawedBack = await clawBackLateRefunds()
    const cancelledEarly = await cancelPendingRefundedOrders()
    if (confirmed || clawedBack || cancelledEarly) {
      logger.info(
        `[AffiliateCommissionQueue] confirmed=${confirmed} clawedBack=${clawedBack} cancelledBeforeConfirm=${cancelledEarly}`,
      )
    }
  } catch (error) {
    logger.error('[AffiliateCommissionQueue] Tick failed:', error)
  } finally {
    queueBusy = false
  }
}

export function startAffiliateCommissionWorker(): void {
  if (queueStarted) return
  if (!isQueueEnabled()) {
    logger.info('[AffiliateCommissionQueue] AFFILIATE_QUEUE_ENABLED=false -- this instance will not run commission confirmation.')
    return
  }
  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(60_000, WORKER_INTERVAL_MS))
  void processQueueTick()
  logger.info(`[AffiliateCommissionQueue] Worker started (interval=${Math.max(60_000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopAffiliateCommissionWorker(): void {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}
