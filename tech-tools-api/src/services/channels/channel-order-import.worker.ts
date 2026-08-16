/**
 * Automatic order-import poller -- same setInterval-poller shape as
 * channel-product-sync.worker.ts/promotion-campaign.queue.ts. Polling
 * reconciliation, not the sole order-import mechanism: the webhook
 * receiver (channel-webhook.controller.ts) only logs+flags ORDER_STATUS_
 * CHANGE events, deliberately never importing an order directly from a
 * webhook payload (TikTok's webhook signature has no replay protection --
 * see that file's header comment), so this worker is what actually keeps
 * channel_orders current.
 */
import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { importOrders } from './channel-sync.service'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let workerBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.CHANNEL_ORDER_IMPORT_INTERVAL_MS || String(10 * 60 * 1000), 10)

function isQueueEnabled(): boolean {
  // Two independent kill switches (Production Review Round 1 §28):
  // CHANNEL_SYNC_QUEUE_ENABLED stops every channel worker at once (the
  // single-instance-topology safety valve, same as PROMOTION_QUEUE_ENABLED);
  // CHANNEL_ORDER_IMPORT_WORKER_ENABLED stops only this one, e.g. to
  // investigate an order-import-specific issue without also pausing
  // product sync/inventory diff.
  return process.env.CHANNEL_SYNC_QUEUE_ENABLED !== 'false' && process.env.CHANNEL_ORDER_IMPORT_WORKER_ENABLED !== 'false'
}

async function processTick(): Promise<void> {
  if (workerBusy) return
  workerBusy = true
  try {
    const result = await query(
      `SELECT id FROM commerce_channel_accounts WHERE status = 'CONNECTED' AND disabled_by_admin = false`,
    )
    for (const row of result.rows) {
      try {
        // triggeredBy = null -- an automated/scheduled run, matching this
        // domain's NULL-for-system convention.
        await importOrders(row.id, null)
      } catch (error) {
        logger.error(`[ChannelOrderImportWorker] Import failed for channel account ${row.id}`, error)
      }
    }
  } catch (error) {
    logger.error('[ChannelOrderImportWorker] Tick failed', error)
  } finally {
    workerBusy = false
  }
}

export function startChannelOrderImportWorker(): void {
  if (workerStarted) return

  if (!isQueueEnabled()) {
    logger.info('[ChannelOrderImportWorker] Disabled via CHANNEL_SYNC_QUEUE_ENABLED or CHANNEL_ORDER_IMPORT_WORKER_ENABLED.')
    return
  }

  workerStarted = true
  workerTimer = setInterval(() => {
    void processTick()
  }, Math.max(60000, WORKER_INTERVAL_MS))

  void processTick()

  logger.info(`[ChannelOrderImportWorker] Worker started (interval=${Math.max(60000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopChannelOrderImportWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}

export { processTick as __processChannelOrderImportTickForTests }
