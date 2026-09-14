/**
 * Wishlist Alerts (back in stock / price drop) -- same shape as
 * abandoned-checkout.queue.ts / promotion-campaign.queue.ts (this
 * codebase's one consistent async-worker convention: a plain setInterval
 * poller + a re-entrancy guard, no separate job-queue infrastructure).
 *
 * Only buildable now that the wishlist is real (migration 063 + the new
 * wishlist.controller.ts) -- before that, the `wishlist` table had zero
 * real rows in production (both frontends kept it purely client-side).
 *
 * Detects a real TRANSITION, not a current state -- a naive "is this
 * product currently in stock / on sale" check would fire on every tick
 * forever. `wishlist.last_checked_in_stock`/`last_checked_price` record
 * what was true at the last tick:
 *  - First observation (both NULL): just record the baseline, no alert
 *    (never a false-positive flood the moment this ships).
 *  - Was out of stock, now in stock -> back-in-stock alert.
 *  - Price dropped by at least WISHLIST_PRICE_DROP_MIN_PERCENT% from the
 *    last observed price -> price-drop alert (avoids firing on cent-level
 *    noise).
 * Both snapshot columns are updated to the current values every tick,
 * whether or not an alert fired -- that's what makes this a transition
 * detector instead of a repeat-every-tick spammer.
 *
 * Same known limitation as every other worker in this family: no
 * `FOR UPDATE SKIP LOCKED` -- safety rests on the single-process
 * assumption (docker-compose.prod.yml runs exactly one API container)
 * plus the busy-guard below, not row-level locking.
 */
import { query } from '../database/connection'
import logger from '../utils/logger'
import { sendBackInStockEmail, sendPriceDropEmail } from '../utils/email'
import { NotificationService } from './notification.service'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.WISHLIST_ALERTS_QUEUE_INTERVAL_MS || '1800000', 10)
const PRICE_DROP_MIN_PERCENT = Number.parseFloat(process.env.WISHLIST_PRICE_DROP_MIN_PERCENT || '5')
const BATCH_SIZE = 500

function isQueueEnabled(): boolean {
  return process.env.WISHLIST_ALERTS_QUEUE_ENABLED !== 'false'
}

interface WishlistRow {
  wishlist_id: string
  user_id: string
  user_email: string
  product_id: string
  product_name: string
  product_slug: string
  product_image: string | null
  current_price: string
  current_in_stock: boolean
  last_checked_price: string | null
  last_checked_in_stock: boolean | null
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true

  try {
    const result = await query(
      `SELECT
        w.id as wishlist_id,
        w.user_id,
        u.email as user_email,
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        (
          SELECT pm.url FROM product_media pm
          WHERE pm.product_id = p.id AND pm.type = 'image'
          ORDER BY pm.is_primary DESC, pm.position LIMIT 1
        ) as product_image,
        COALESCE(p.sale_price, p.base_price) as current_price,
        (COALESCE((SELECT SUM(i.available_stock) FROM inventory i WHERE i.product_id = p.id), 0) > 0) as current_in_stock,
        w.last_checked_price,
        w.last_checked_in_stock
       FROM wishlist w
       JOIN products p ON p.id = w.product_id
       JOIN users u ON u.id = w.user_id
       WHERE p.is_active = TRUE AND p.deleted_at IS NULL
       ORDER BY w.added_at ASC
       LIMIT $1`,
      [BATCH_SIZE],
    )

    for (const row of result.rows as WishlistRow[]) {
      try {
        await processRow(row)
      } catch (error) {
        logger.error(`[WishlistAlertsQueue] Failed to process wishlist row ${row.wishlist_id}`, error)
      }
    }
  } catch (error) {
    logger.error('[WishlistAlertsQueue] Queue tick failed', error)
  } finally {
    queueBusy = false
  }
}

async function processRow(row: WishlistRow): Promise<void> {
  const currentPrice = Number(row.current_price)
  const previousPrice = row.last_checked_price !== null ? Number(row.last_checked_price) : null
  const isFirstObservation = row.last_checked_in_stock === null && previousPrice === null

  if (!isFirstObservation) {
    // Back in stock: was explicitly known out of stock, now in stock.
    if (row.last_checked_in_stock === false && row.current_in_stock) {
      await sendBackInStockEmail(row.user_email, {
        productName: row.product_name,
        productSlug: row.product_slug,
        productImage: row.product_image,
        price: currentPrice,
      })

      await NotificationService.create({
        userId: row.user_id,
        type: 'product_back_in_stock',
        title: 'Back in stock!',
        message: `${row.product_name} is back in stock.`,
        actionUrl: `/product/${row.product_slug}`,
        actionLabel: 'Shop Now',
        data: { productSlug: row.product_slug },
        sendPush: true,
      })

      logger.info(`[WishlistAlertsQueue] Back-in-stock alert sent for ${row.product_slug} to user ${row.user_id}`)
    } else if (
      previousPrice !== null &&
      currentPrice < previousPrice * (1 - PRICE_DROP_MIN_PERCENT / 100)
    ) {
      await sendPriceDropEmail(row.user_email, {
        productName: row.product_name,
        productSlug: row.product_slug,
        productImage: row.product_image,
        price: currentPrice,
        oldPrice: previousPrice,
      })

      await NotificationService.create({
        userId: row.user_id,
        type: 'product_price_drop',
        title: 'Price drop!',
        message: `${row.product_name} just dropped to $${currentPrice.toFixed(2)}.`,
        actionUrl: `/product/${row.product_slug}`,
        actionLabel: 'Shop Now',
        data: { productSlug: row.product_slug },
        sendPush: true,
      })

      logger.info(`[WishlistAlertsQueue] Price-drop alert sent for ${row.product_slug} to user ${row.user_id}`)
    }
  }

  await query(
    `UPDATE wishlist SET last_checked_price = $1, last_checked_in_stock = $2 WHERE id = $3`,
    [currentPrice, row.current_in_stock, row.wishlist_id],
  )
}

export function startWishlistAlertsQueueWorker(): void {
  if (queueStarted) return

  if (!isQueueEnabled()) {
    logger.info('[WishlistAlertsQueue] WISHLIST_ALERTS_QUEUE_ENABLED=false -- worker not started.')
    return
  }

  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(60000, WORKER_INTERVAL_MS))

  void processQueueTick()

  logger.info(
    `[WishlistAlertsQueue] Worker started (interval=${Math.max(60000, WORKER_INTERVAL_MS)}ms, priceDropMinPercent=${PRICE_DROP_MIN_PERCENT}%)`,
  )
}

export function stopWishlistAlertsQueueWorker(): void {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}

export { processQueueTick as __processQueueTickForTests }
