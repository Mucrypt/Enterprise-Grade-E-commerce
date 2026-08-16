import * as dotenv from 'dotenv'
dotenv.config()

// Pins the whole Node process to UTC, so every `new Date()`/local-getter
// call (event ingestion timestamps written to the schema's several
// `timestamp without time zone` columns, the previous-year comparison
// math, etc.) behaves identically regardless of host/OS default -- see
// docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md's Production Review
// Round 1 §6. Must run before any other module constructs a Date.
process.env.TZ = process.env.TZ || 'UTC'

import http from 'http'
import app from './app'
import { connectDatabase } from './database/connection'
import { connectRedis } from './config/redis'
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
import { webSocketService } from './services/websocket.service'
import { notificationDispatcher } from './services/notification-dispatcher.service'
import shippingService from './services/shipping'
import logger from './utils/logger'

const PORT = process.env.PORT || 9000

// Create HTTP server for Socket.io
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

    // Initialize Socket.io
    webSocketService.initialize(httpServer)

    // Initialize notification services (email, Slack, SMS)
    notificationDispatcher.initializeAll()

    // Start background workers
    startNewsletterQueueWorker()
    startSupplierGuardrailsWorker()
    startAnomalyDetectionWorker()
    startMetricsBroadcaster()
    startPromotionQueueWorker()
    startChannelProductSyncWorker()
    startChannelInventoryDiffWorker()
    startChannelOrderImportWorker()

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`)
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
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...')
  stopNewsletterQueueWorker()
  stopSupplierGuardrailsWorker()
  stopAnomalyDetectionWorker()
  stopMetricsBroadcaster()
  stopPromotionQueueWorker()
  stopChannelProductSyncWorker()
  stopChannelInventoryDiffWorker()
  stopChannelOrderImportWorker()
  httpServer.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  stopNewsletterQueueWorker()
  stopSupplierGuardrailsWorker()
  stopAnomalyDetectionWorker()
  stopMetricsBroadcaster()
  stopPromotionQueueWorker()
  stopChannelProductSyncWorker()
  stopChannelInventoryDiffWorker()
  stopChannelOrderImportWorker()
  httpServer.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})
