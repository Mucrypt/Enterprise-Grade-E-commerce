import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import logger from '../utils/logger'
import getRedisClient from '../config/redis'

export interface AuthRequest extends Request {
  user?: {
    id: any
    userId: string
    email: string
    userType: string
  }
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
      })
    }

    const token = authHeader.split(' ')[1]

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as jwt.JwtPayload

      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
      }

      next()
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      })
    }
  } catch (error) {
    logger.error('Authentication error:', error)
    next(error)
  }
}

export const authenticateIfPresent = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.split(' ')[1]

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as jwt.JwtPayload

      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
      }
    } catch {
      // Ignore invalid tokens on public routes.
    }

    next()
  } catch (error) {
    logger.error('Optional authentication error:', error)
    next(error)
  }
}

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      })
    }

    next()
  }
}

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      })
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!,
    ) as jwt.JwtPayload

    const redisClient = getRedisClient()
    const storedToken = await redisClient.get(`refresh:${decoded.userId}`)

    if (storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      })
    }

    // Generate new access token
    const user = await getUserById(decoded.userId)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      })
    }

    const jwtSecret = process.env.JWT_SECRET || 'default-secret'
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.user_type,
      },
      jwtSecret,
      { expiresIn: '15m' },
    )

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Helper function
async function getUserById(userId: string) {
  const { query } = await import('../database/connection')
  const result = await query(
    'SELECT id, email, user_type FROM users WHERE id = $1 AND is_active = true',
    [userId],
  )
  return result.rows[0]
}
