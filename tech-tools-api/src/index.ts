import * as dotenv from 'dotenv'
dotenv.config()

// Pins the whole Node process to UTC, so every `new Date()`/local-getter
// call (event ingestion timestamps written to the schema's several
// `timestamp without time zone` columns, the previous-year comparison
// math, etc.) behaves identically regardless of host/OS default -- see
// docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md's Production Review
// Round 1 §6. Must run before any other module constructs a Date.
process.env.TZ = process.env.TZ || 'UTC'

import cluster from 'cluster'
import http from 'http'
import app from './app'
import { connectDatabase } from './database/connection'
import { connectRedis } from './config/redis'
import { resolveWorkerCount } from './utils/cluster-config'
import {
  startNewsletterQueueWorker,
  stopNewsletterQueueWorker,
} from './services/newsletter.queue'
import {
  startSupplierGuardrailsWorker,
  stopSupplierGuardrailsWorker,
} from './services/supplier.guardrails'
import {
  startAnomalyDetectionWorker,
  stopAnomalyDetectionWorker,
} from './workers/anomaly.detection'
import {
  startMetricsBroadcaster,
  stopMetricsBroadcaster,
} from './workers/metrics.broadcaster'
import {
  startPromotionQueueWorker,
  stopPromotionQueueWorker,
} from './services/promotion-campaign.queue'
import {
  startAffiliateCommissionWorker,
  stopAffiliateCommissionWorker,
} from './services/affiliate-commission.queue'
import {
  startChannelProductSyncWorker,
  stopChannelProductSyncWorker,
} from './services/channels/channel-product-sync.worker'
import {
  startChannelInventoryDiffWorker,
  stopChannelInventoryDiffWorker,
} from './services/channels/channel-inventory-diff.worker'
import {
  startChannelOrderImportWorker,
  stopChannelOrderImportWorker,
} from './services/channels/channel-order-import.worker'
import {
  startSourcingRewriteWorker,
  stopSourcingRewriteWorker,
} from './services/sourcing/sourcing-rewrite.worker'
import { webSocketService } from './services/websocket.service'
import { notificationDispatcher } from './services/notification-dispatcher.service'
import shippingService from './services/shipping'
import logger from './utils/logger'

const PORT = process.env.PORT || 9000
const numWorkers = resolveWorkerCount()

if (cluster.isPrimary && numWorkers > 1) {
  // ---------------------------------------------------------------------
  // Primary process: forks one worker per CPU core and exits nothing on
  // its own -- every request is handled by a worker below. Node's cluster
  // module load-balances incoming connections across them automatically
  // (all workers listen on the same PORT). If a worker dies, it's
  // restarted rather than silently shrinking capacity.
  // ---------------------------------------------------------------------
  logger.info(
    `🧵 Primary ${process.pid} starting ${numWorkers} worker processes (one per CPU core) -- set WEB_CONCURRENCY to override`,
  )
  for (let i = 0; i < numWorkers; i++) cluster.fork()

  cluster.on('exit', (worker, code, signal) => {
    logger.error(
      `Worker ${worker.process.pid} exited (code=${code}, signal=${signal}) -- restarting it`,
    )
    cluster.fork()
  })

  const shutdownPrimary = (signal: NodeJS.Signals) => {
    logger.info(`Primary received ${signal}. Signaling all workers to shut down...`)
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill(signal)
    }
  }
  process.on('SIGTERM', () => shutdownPrimary('SIGTERM'))
  process.on('SIGINT', () => shutdownPrimary('SIGINT'))
} else {
  // ---------------------------------------------------------------------
  // Worker process (or the single process when clustering is off, e.g.
  // `npm run dev`, or NODE_ENV != production). This is the original
  // single-process startup logic, unchanged, except for one addition:
  // singleton work (queue pollers, channel sync, the metrics broadcaster)
  // only runs in ONE worker -- running it in every clustered worker would
  // multiply emails sent and external API calls made. Socket.io itself is
  // NOT singleton-gated (see websocket.service.ts's initialize() doc
  // comment): every worker must host it, with a Redis adapter fanning
  // broadcasts out across all of them, since nginx/cluster round-robins
  // WebSocket connections across every worker with no way to pin them to
  // just one.
  // ---------------------------------------------------------------------
  const isSingletonWorker = !cluster.isWorker || cluster.worker?.id === 1

  const httpServer = http.createServer(app)

  async function startServer() {
    try {
      // Connect to database
      await connectDatabase()
      logger.info('✅ Database connected successfully')

      // Connect to Redis
      await connectRedis()
      logger.info('✅ Redis connected successfully')

      // Load shipping carrier credentials from the database. Previously this
      // only ran when an admin edited a carrier via the dashboard, so a fresh
      // deploy (or a restart before any admin touched carrier settings) had
      // zero enabled carriers until someone happened to open that screen.
      // Non-fatal on failure -- ShippingService.initialize() already logs and
      // leaves carriers disabled rather than throwing, which now correctly
      // surfaces as "carrier unavailable" (see shipping.config.ts) instead of
      // silently falling back to mock data outside development.
      await shippingService.initialize()
      logger.info(
        `✅ Shipping carriers initialized: ${
          shippingService.getEnabledCarriers().join(', ') || 'none enabled'
        }`,
      )

      // Every worker hosts Socket.io (see the isSingletonWorker comment
      // above) -- must come after connectRedis() since it duplicates the
      // shared Redis client for its pub/sub adapter.
      await webSocketService.initialize(httpServer)

      if (isSingletonWorker) {
        // Initialize notification services (email, Slack, SMS)
        notificationDispatcher.initializeAll()

        // Start background workers
        startNewsletterQueueWorker()
        startSupplierGuardrailsWorker()
        startAnomalyDetectionWorker()
        startMetricsBroadcaster()
        startPromotionQueueWorker()
        startAffiliateCommissionWorker()
        startChannelProductSyncWorker()
        startChannelInventoryDiffWorker()
        startChannelOrderImportWorker()
        startSourcingRewriteWorker()
      }

      // Start server
      httpServer.listen(PORT, () => {
        const workerLabel = cluster.isWorker ? ` (worker ${cluster.worker?.id}, pid ${process.pid})` : ''
        logger.info(`🚀 Server running on port ${PORT}${workerLabel}`)
        logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`)
        logger.info(`🔍 Health check: http://localhost:${PORT}/health`)
        logger.info(`🔌 WebSocket: ws://localhost:${PORT}`)
      })
    } catch (error) {
      logger.error('Failed to start server:', error)
      process.exit(1)
    }
  }

  startServer()

  // Graceful shutdown
  const shutdownWorker = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`)
    if (isSingletonWorker) {
      stopNewsletterQueueWorker()
      stopSupplierGuardrailsWorker()
      stopAnomalyDetectionWorker()
      stopMetricsBroadcaster()
      stopPromotionQueueWorker()
      stopAffiliateCommissionWorker()
      stopChannelProductSyncWorker()
      stopChannelInventoryDiffWorker()
      stopChannelOrderImportWorker()
      stopSourcingRewriteWorker()
    }
    httpServer.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdownWorker('SIGTERM'))
  process.on('SIGINT', () => shutdownWorker('SIGINT'))
}
