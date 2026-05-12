import * as dotenv from 'dotenv'
dotenv.config()

import app from './app'
import { connectDatabase } from './database/connection'
import { connectRedis } from './config/redis'
import {
  startNewsletterQueueWorker,
  stopNewsletterQueueWorker,
} from './services/newsletter.queue'
import logger from './utils/logger'

const PORT = process.env.PORT || 9000

async function startServer() {
  try {
    // Connect to database
    await connectDatabase()
    logger.info('✅ Database connected successfully')

    // Connect to Redis
    await connectRedis()
    logger.info('✅ Redis connected successfully')

    // Start background newsletter queue worker
    startNewsletterQueueWorker()

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`)
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`)
      logger.info(`🔍 Health check: http://localhost:${PORT}/health`)
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
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  stopNewsletterQueueWorker()
  process.exit(0)
})
