import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

import { query } from '../../../database/connection'
import getRedisClient from '../../../config/redis'
import logger from '../../../utils/logger'
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../../../utils/email'
import type { AuthRequest } from '../../../middleware/auth'
import NotificationEvents from '../../../services/notification.events'
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../../../config/jwt.config'

export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      userType,
      companyName,
    } = req.body

    // SECURITY: Prevent direct admin/super_admin registration
    // Admins must be invited through proper channels
    const accountType = role || userType || 'customer'

    if (accountType === 'admin' || accountType === 'super_admin') {
      return res.status(403).json({
        success: false,
        error:
          'Admin accounts cannot be created through registration. Please contact an administrator for an invitation.',
      })
    }

    // Only allow customer registration
    const finalUserType = 'customer'

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ])

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      })
    }

    // Hash password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create verification token
    const verificationToken = uuidv4()

    // Insert user
    const result = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone, 
        user_type, company_name, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name, user_type, created_at`,
      [
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        finalUserType,
        companyName,
        false,
      ],
    )

    const user = result.rows[0]

    // Store verification token in Redis (24 hour expiry)
    const redisClient = getRedisClient()
    await redisClient.set(`verification:${verificationToken}`, user.id, {
      EX: 24 * 60 * 60,
    })

    // Send verification email
    await sendVerificationEmail(email, verificationToken)

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '15m' },
    )

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    })

    // Store refresh token in Redis
    await redisClient.set(`refresh:${user.id}`, refreshToken, {
      EX: 7 * 24 * 60 * 60,
    })

    logger.info('User registered successfully:', { email, userId: user.id })

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type,
          createdAt: user.created_at,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    })
  } catch (error) {
    logger.error('Registration error:', error)
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // Find user (include lockout fields)
    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, 
       user_type, is_active, email_verified, created_at,
       failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      })
    }

    const user = result.rows[0]

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockTimeRemaining = Math.ceil(
        (new Date(user.locked_until).getTime() - new Date().getTime()) / 60000,
      )
      logger.warn(
        `Account locked: ${email}. Remaining: ${lockTimeRemaining}min`,
      )
      return res.status(429).json({
        success: false,
        error: `Account is temporarily locked. Try again in ${lockTimeRemaining} minutes.`,
      })
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated',
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      // Increment failed attempts
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1
      const MAX_ATTEMPTS = 5
      const LOCKOUT_MINUTES = 30

      if (newFailedAttempts >= MAX_ATTEMPTS) {
        // Lock account for 30 minutes
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        await query(
          `UPDATE users 
           SET failed_login_attempts = $1, locked_until = $2 
           WHERE id = $3`,
          [newFailedAttempts, lockUntil, user.id],
        )
        logger.warn(
          `Account locked after ${newFailedAttempts} failed attempts: ${email}`,
        )
        return res.status(429).json({
          success: false,
          error: `Too many failed login attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        })
      } else {
        // Just increment counter
        await query(
          `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
          [newFailedAttempts, user.id],
        )
        logger.warn(
          `Failed login attempt (${newFailedAttempts}/${MAX_ATTEMPTS}): ${email}`,
        )
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      })
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '15m' },
    )

    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    })

    // Store refresh token in Redis
    const redisClient = getRedisClient()
    await redisClient.set(`refresh:${user.id}`, refreshToken, {
      EX: 7 * 24 * 60 * 60,
    })

    // Update last login and reset failed attempts on successful login
    await query(
      `UPDATE users 
       SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL 
       WHERE id = $1`,
      [user.id],
    )

    logger.info('User logged in:', { email, userId: user.id })

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: 'Login failed',
    })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      })
    }

    const token = authHeader.split(' ')[1]

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload

      // Remove refresh token from Redis
      const redisClient = getRedisClient()
      await redisClient.del(`refresh:${decoded.userId}`)

      logger.info('User logged out:', { userId: decoded.userId })

      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    } catch (error) {
      // Token might be expired, but we still respond successfully
      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    }
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    })
  }
}

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const result = await query(
      `SELECT id, email, first_name, last_name, user_type, email_verified, created_at
       FROM users
       WHERE id = $1 AND is_active = true`,
      [req.user.userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = result.rows[0]

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
        },
      },
    })
  } catch (error) {
    logger.error('Get current user error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch current user',
    })
  }
}

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token required',
      })
    }

    const redisClient = getRedisClient()
    const userId = await redisClient.get(`verification:${token}`)

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      })
    }

    // Update user email verification status
    await query('UPDATE users SET email_verified = true WHERE id = $1', [
      userId,
    ])

    // Remove verification token from Redis
    await redisClient.del(`verification:${token}`)

    logger.info('Email verified:', { userId })

    res.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    logger.error('Email verification error:', error)
    res.status(500).json({
      success: false,
      error: 'Email verification failed',
    })
  }
}

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    // Check if user exists
    const result = await query('SELECT id, email FROM users WHERE email = $1', [
      email,
    ])

    if (result.rows.length === 0) {
      // Don't reveal that user doesn't exist
      return res.json({
        success: true,
        message:
          'If an account exists with this email, you will receive a password reset link',
      })
    }

    const user = result.rows[0]
    const resetToken = uuidv4()

    // Store reset token in Redis (1 hour expiry)
    const redisClient = getRedisClient()
    await redisClient.set(`reset:${resetToken}`, user.id, { EX: 60 * 60 })

    // Send password reset email
    await sendPasswordResetEmail(email, resetToken)

    logger.info('Password reset requested:', { email, userId: user.id })

    res.json({
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link',
    })
  } catch (error) {
    logger.error('Forgot password error:', error)
    res.status(500).json({
      success: false,
      error: 'Password reset request failed',
    })
  }
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      })
    }

    const redisClient = getRedisClient()
    const userId = await redisClient.get(`reset:${token}`)

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      })
    }

    // Hash new password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update user password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      userId,
    ])

    // Remove reset token from Redis
    await redisClient.del(`reset:${token}`)

    // Remove all refresh tokens for this user
    await redisClient.del(`refresh:${userId}`)

    logger.info('Password reset successfully:', { userId })

    res.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    logger.error('Reset password error:', error)
    res.status(500).json({
      success: false,
      error: 'Password reset failed',
    })
  }
}
