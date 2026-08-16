/**
 * Automatic product-sync preview refresher -- same setInterval-poller
 * shape as promotion-campaign.queue.ts/newsletter.queue.ts (this
 * codebase's one consistent async-worker convention; no Bull/BullMQ
 * introduced). Only ever runs previewProductSync() (read + diff) -- commit
 * stays a deliberate human action via POST /channels/products/commit-sync,
 * per the founder's explicit "do not automatically overwrite TikTok
 * listings" instruction. This worker's whole job is keeping the diff
 * fresh so the ops UI never shows a stale "last synced 4 hours ago" number
 * when a human does decide to review and commit.
 */
import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { previewProductSync } from './channel-sync.service'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let workerBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.CHANNEL_PRODUCT_SYNC_INTERVAL_MS || String(30 * 60 * 1000), 10)

function isQueueEnabled(): boolean {
  // Two independent kill switches (Production Review Round 1 §28) -- see
  // channel-order-import.worker.ts's identical comment.
  return process.env.CHANNEL_SYNC_QUEUE_ENABLED !== 'false' && process.env.CHANNEL_PRODUCT_SYNC_WORKER_ENABLED !== 'false'
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
        // triggeredBy = null -- an automated/scheduled run, matching
        // channel_activity_log/channel_sync_runs' NULL-for-system
        // convention used throughout this domain.
        await previewProductSync(row.id, null)
      } catch (error) {
        logger.error(`[ChannelProductSyncWorker] Preview failed for channel account ${row.id}`, error)
      }
    }
  } catch (error) {
    logger.error('[ChannelProductSyncWorker] Tick failed', error)
  } finally {
    workerBusy = false
  }
}

export function startChannelProductSyncWorker(): void {
  if (workerStarted) return

  if (!isQueueEnabled()) {
    logger.info('[ChannelProductSyncWorker] Disabled via CHANNEL_SYNC_QUEUE_ENABLED or CHANNEL_PRODUCT_SYNC_WORKER_ENABLED.')
    return
  }

  workerStarted = true
  workerTimer = setInterval(() => {
    void processTick()
  }, Math.max(60000, WORKER_INTERVAL_MS))

  void processTick()

  logger.info(`[ChannelProductSyncWorker] Worker started (interval=${Math.max(60000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopChannelProductSyncWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}

export { processTick as __processChannelProductSyncTickForTests }
