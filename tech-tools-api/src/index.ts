import * as dotenv from 'dotenv'
dotenv.config()

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
import { webSocketService } from './services/websocket.service'
import { notificationDispatcher } from './services/notification-dispatcher.service'
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

    // Initialize Socket.io
    webSocketService.initialize(httpServer)

    // Initialize notification services (email, Slack, SMS)
    notificationDispatcher.initializeAll()

    // Start background workers
    startNewsletterQueueWorker()
    startSupplierGuardrailsWorker()
    startAnomalyDetectionWorker()
    startMetricsBroadcaster()

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
  httpServer.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})
