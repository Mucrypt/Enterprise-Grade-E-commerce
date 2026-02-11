/**
 * Redis Client for Session & Cache Management
 * Enterprise-grade Redis setup with error handling
 */

import Redis from 'ioredis'

const getRedisUrl = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379'
}

const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

redis.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redis.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

redis.on('ready', () => {
  console.log('✅ Redis ready for operations')
})

// Session management
export const sessionManager = {
  async set(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    try {
      await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data))
    } catch (error) {
      console.error('Error setting session:', error)
      throw error
    }
  },

  async get(sessionId: string): Promise<any | null> {
    try {
      const data = await redis.get(`session:${sessionId}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  },

  async delete(sessionId: string): Promise<void> {
    try {
      await redis.del(`session:${sessionId}`)
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  },

  async exists(sessionId: string): Promise<boolean> {
    try {
      const result = await redis.exists(`session:${sessionId}`)
      return result === 1
    } catch (error) {
      console.error('Error checking session existence:', error)
      return false
    }
  },
}

// Cache management
export const cacheManager = {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redis.setex(`cache:${key}`, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Error setting cache:', error)
    }
  },

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(`cache:${key}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error getting cache:', error)
      return null
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redis.del(`cache:${key}`)
    } catch (error) {
      console.error('Error deleting cache:', error)
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(`cache:${pattern}`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Error invalidating cache pattern:', error)
    }
  },
}

// Rate limiting
export const rateLimiter = {
  async check(
    identifier: string,
    limit: number = 100,
    window: number = 60,
  ): Promise<boolean> {
    try {
      const key = `ratelimit:${identifier}`
      const current = await redis.incr(key)

      if (current === 1) {
        await redis.expire(key, window)
      }

      return current <= limit
    } catch (error) {
      console.error('Error checking rate limit:', error)
      return true // Allow on error
    }
  },
}

export default redis
