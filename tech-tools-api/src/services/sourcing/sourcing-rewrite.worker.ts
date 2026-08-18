/**
 * Automatic AI-rewrite poller (SOURCING-1) -- same setInterval-poller
 * shape as channel-product-sync.worker.ts/promotion-campaign.queue.ts
 * (this codebase's one consistent async-worker convention; no
 * Bull/BullMQ introduced). Picks up newly captured products and runs
 * rewriteSourcedProduct() so the extension's capture call never has to
 * wait on OpenAI. rewrite_attempt_count caps retries so a permanently
 * broken OPENAI_API_KEY doesn't spin forever against the same rows.
 */
import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { rewriteSourcedProduct } from './sourcing-rewrite.service'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let workerBusy = false

const WORKER_INTERVAL_MS = Number.parseInt(process.env.SOURCING_REWRITE_INTERVAL_MS || String(60 * 1000), 10)
const MAX_REWRITE_ATTEMPTS = 3
const BATCH_SIZE = 10

function isQueueEnabled(): boolean {
  return process.env.SOURCING_REWRITE_WORKER_ENABLED !== 'false'
}

async function processTick(): Promise<void> {
  if (workerBusy) return
  workerBusy = true
  try {
    const result = await query(
      `SELECT id FROM sourced_products WHERE status = 'captured' AND rewrite_attempt_count < $1 ORDER BY captured_at ASC LIMIT $2`,
      [MAX_REWRITE_ATTEMPTS, BATCH_SIZE],
    )
    for (const row of result.rows) {
      try {
        await rewriteSourcedProduct(row.id)
      } catch (error) {
        logger.error(`[SourcingRewriteWorker] Rewrite failed for sourced product ${row.id}`, error)
      }
    }
  } catch (error) {
    logger.error('[SourcingRewriteWorker] Tick failed', error)
  } finally {
    workerBusy = false
  }
}

export function startSourcingRewriteWorker(): void {
  if (workerStarted) return

  if (!isQueueEnabled()) {
    logger.info('[SourcingRewriteWorker] Disabled via SOURCING_REWRITE_WORKER_ENABLED.')
    return
  }

  workerStarted = true
  workerTimer = setInterval(() => {
    void processTick()
  }, Math.max(30000, WORKER_INTERVAL_MS))

  void processTick()

  logger.info(`[SourcingRewriteWorker] Worker started (interval=${Math.max(30000, WORKER_INTERVAL_MS)}ms)`)
}

export function stopSourcingRewriteWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}

export { processTick as __processSourcingRewriteTickForTests }
