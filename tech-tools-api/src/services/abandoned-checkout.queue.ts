/**
 * Abandoned Checkout Recovery -- same shape as promotion-campaign.queue.ts
 * / newsletter.queue.ts (this codebase's one consistent async-worker
 * convention: a plain setInterval poller + a re-entrancy guard, no
 * separate job-queue infrastructure).
 *
 * createOrderCheckoutSession (order.controller.ts) creates a real `orders`
 * row (payment_status='pending') with real inventory.reserved_stock
 * BEFORE Stripe is ever contacted. If the buyer never completes payment,
 * that row previously sat forever -- no follow-up, and the stock it
 * reserved was never released back to available_stock. This worker does
 * two independent things on every tick:
 *
 *  1. Nudge: any pending order older than the nudge window that hasn't
 *     been nudged yet gets a real recovery email (+ push, if the buyer is
 *     a logged-in user with a registered device).
 *  2. Release: any pending order older than the (much longer) cancel
 *     window gets cancelled and its reserved stock released, using the
 *     exact same UPDATE inventory ... reserved_stock = GREATEST(0, ...)
 *     pattern already proven in order.controller.ts's cancelOrder.
 *
 * Same known limitation as every other worker in this file's family: no
 * `FOR UPDATE SKIP LOCKED` -- safety rests on the single-process
 * assumption (docker-compose.prod.yml runs exactly one API container)
 * plus the busy-guard below, not row-level locking.
 */
import { query } from '../database/connection'
import logger from '../utils/logger'
import { sendAbandonedCheckoutEmail } from '../utils/email'
import { NotificationService } from './notification.service'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.ABANDONED_CHECKOUT_QUEUE_INTERVAL_MS || '300000', 10)
const NUDGE_AFTER_MINUTES = Number.parseInt(process.env.ABANDONED_CHECKOUT_NUDGE_AFTER_MINUTES || '60', 10)
const CANCEL_AFTER_HOURS = Number.parseInt(process.env.ABANDONED_CHECKOUT_CANCEL_AFTER_HOURS || '48', 10)
const BATCH_SIZE = 25

function isQueueEnabled(): boolean {
  return process.env.ABANDONED_CHECKOUT_QUEUE_ENABLED !== 'false'
}

interface NudgeCandidate {
  id: string
  order_number: string
  grand_total: string
  shipping_address: { firstName?: string; lastName?: string } | null
  user_id: string | null
  guest_email: string | null
  guest_first_name: string | null
  user_email: string | null
}

async function sendNudges(): Promise<void> {
  // Claim before processing -- set recovery_email_sent_at as part of the
  // same UPDATE that selects the batch, so a slow email send or a crash
  // mid-batch can never result in the same order being emailed twice.
  const result = await query(
    `UPDATE orders o
     SET recovery_email_sent_at = NOW()
     WHERE o.id IN (
       SELECT id FROM orders
       WHERE payment_status = 'pending'
         AND order_status <> 'cancelled'
         AND recovery_email_sent_at IS NULL
         AND created_at < NOW() - make_interval(mins => $1)
       ORDER BY created_at ASC
       LIMIT $2
     )
     RETURNING o.id, o.order_number, o.grand_total, o.shipping_address, o.user_id, o.guest_email, o.guest_first_name,
       (SELECT email FROM users WHERE id = o.user_id) as user_email`,
    [NUDGE_AFTER_MINUTES, BATCH_SIZE],
  )

  for (const order of result.rows as NudgeCandidate[]) {
    try {
      const email = order.user_email || order.guest_email
      if (!email) continue

      const itemsResult = await query(
        'SELECT product_name, quantity, unit_price, total_price FROM order_items WHERE order_id = $1',
        [order.id],
      )
      if (itemsResult.rows.length === 0) continue

      const customerName =
        order.shipping_address?.firstName || order.guest_first_name || 'there'

      await sendAbandonedCheckoutEmail(email, {
        orderNumber: order.order_number,
        customerName,
        items: itemsResult.rows.map((item: any) => ({
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          totalPrice: Number(item.total_price),
        })),
        grandTotal: Number(order.grand_total),
      })

      if (order.user_id) {
        await NotificationService.create({
          userId: order.user_id,
          type: 'abandoned_checkout',
          title: 'You left something behind!',
          message: `Your order #${order.order_number} is still waiting -- complete it before your items sell out.`,
          actionUrl: '/cart',
          actionLabel: 'Complete Order',
          sendPush: true,
        })
      }

      logger.info(`[AbandonedCheckoutQueue] Sent recovery nudge for order ${order.order_number}`)
    } catch (error) {
      logger.error(`[AbandonedCheckoutQueue] Failed to nudge order ${order.id}`, error)
    }
  }
}

async function releaseStaleReservations(): Promise<void> {
  const staleOrders = await query(
    `SELECT id, order_number FROM orders
     WHERE payment_status = 'pending'
       AND order_status <> 'cancelled'
       AND created_at < NOW() - make_interval(hours => $1)
     LIMIT $2`,
    [CANCEL_AFTER_HOURS, BATCH_SIZE],
  )

  for (const order of staleOrders.rows) {
    try {
      const itemsResult = await query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
        [order.id],
      )

      for (const item of itemsResult.rows) {
        await query(
          `UPDATE inventory SET
            reserved_stock = GREATEST(0, reserved_stock - $1),
            updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id],
        )
      }

      await query(
        `UPDATE orders SET
          order_status = 'cancelled',
          payment_status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_reason = 'Payment not completed within the recovery window',
          updated_at = NOW()
         WHERE id = $1 AND payment_status = 'pending'`,
        [order.id],
      )

      logger.info(`[AbandonedCheckoutQueue] Released stale reservation for order ${order.order_number}`)
    } catch (error) {
      logger.error(`[AbandonedCheckoutQueue] Failed to release order ${order.id}`, error)
    }
  }
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true
  try {
    await sendNudges()
    await releaseStaleReservations()
  } catch (error) {
    logger.error('[AbandonedCheckoutQueue] Queue tick failed', error)
  } finally {
    queueBusy = false
  }
}

export function startAbandonedCheckoutQueueWorker(): void {
  if (queueStarted) return

  if (!isQueueEnabled()) {
    logger.info('[AbandonedCheckoutQueue] ABANDONED_CHECKOUT_QUEUE_ENABLED=false -- worker not started.')
    return
  }

  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(30000, WORKER_INTERVAL_MS))

  void processQueueTick()

  logger.info(
    `[AbandonedCheckoutQueue] Worker started (interval=${Math.max(30000, WORKER_INTERVAL_MS)}ms, nudgeAfter=${NUDGE_AFTER_MINUTES}min, cancelAfter=${CANCEL_AFTER_HOURS}h)`,
  )
}

export function stopAbandonedCheckoutQueueWorker(): void {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}

export { processQueueTick as __processQueueTickForTests }
