/**
 * Automatic inventory-diff refresher -- same setInterval-poller shape as
 * channel-product-sync.worker.ts. READ_ONLY only: runInventoryDiff()
 * never writes to inventory.current_stock/reserved_stock and never calls
 * a channel write endpoint (see channel-sync.service.ts's header comment
 * on that function).
 */
import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { runInventoryDiff } from './channel-sync.service'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let workerBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.CHANNEL_INVENTORY_DIFF_INTERVAL_MS || String(30 * 60 * 1000), 10)

function isQueueEnabled(): boolean {
  // Two independent kill switches (Production Review Round 1 §28) -- see
  // channel-order-import.worker.ts's identical comment.
  return process.env.CHANNEL_SYNC_QUEUE_ENABLED !== 'false' && process.env.CHANNEL_INVENTORY_DIFF_WORKER_ENABLED !== 'false'
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
        await runInventoryDiff(row.id, null)
      } catch (error) {
        logger.error(`[ChannelInventoryDiffWorker] Diff failed for channel account ${row.id}`, error)
      }
    }
  } catch (error) {
    logger.error('[ChannelInventoryDiffWorker] Tick failed', error)
  } finally {
    workerBusy = false
  }
}

export function startChannelInventoryDiffWorker(): void {
  if (workerStarted) return

  if (!isQueueEnabled()) {
    logger.info('[ChannelInventoryDiffWorker] Disabled via CHANNEL_SYNC_QUEUE_ENABLED or CHANNEL_INVENTORY_DIFF_WORKER_ENABLED.')
    return
  }

  workerStarted = true
  workerTimer = setInterval(() => {
    void processTick()
  }, Math.max(60000, WORKER_INTERVAL_MS))

  void processTick()

  logger.info(`[ChannelInventoryDiffWorker] Worker started (interval=${Math.max(60000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopChannelInventoryDiffWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}

export { processTick as __processChannelInventoryDiffTickForTests }
