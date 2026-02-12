import { createClient } from 'redis'
import logger from '../utils/logger'

let redisClient: ReturnType<typeof createClient>

export const createRedisClient = () => {
  const host = process.env.REDIS_HOST || 'localhost'
  const port = process.env.REDIS_PORT || 6379
  const password = process.env.REDIS_PASSWORD

  // Build Redis URL with optional password
  const url = password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`

  return createClient({ url })
}

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createRedisClient()

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err)
    })

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully')
    })

    await redisClient.connect()
  } catch (error) {
    logger.error('Failed to connect to Redis:', error)
    throw error
  }
}

export const getRedisClient = (): ReturnType<typeof createClient> => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.')
  }
  return redisClient
}

export default getRedisClient
