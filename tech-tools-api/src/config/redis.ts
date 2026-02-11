import { createClient } from 'redis'
import logger from '../utils/logger'

let redisClient: ReturnType<typeof createClient>

export const createRedisClient = () => {
  return createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${
      process.env.REDIS_PORT || 6379
    }`,
  })
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
