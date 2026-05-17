import { Router } from 'express'
import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import { authenticate } from '../../../middleware/auth'
import logger from '../../../utils/logger'
import type { AuthRequest } from '../../../middleware/auth'

const router = Router()

/**
 * Admin: Unlock a locked user account
 * POST /api/v1/admin/unlock-account
 * Requires: admin or super_admin role
 */
export const unlockUserAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, email } = req.body

    // Verify requester is admin
    if (
      !req.user ||
      (req.user.userType !== 'admin' && req.user.userType !== 'super_admin')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      })
    }

    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        error: 'Either userId or email is required',
      })
    }

    // Find user
    const findQuery = userId
      ? 'SELECT id, email FROM users WHERE id = $1'
      : 'SELECT id, email FROM users WHERE email = $1'
    const findResult = await query(findQuery, [userId || email])

    if (findResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = findResult.rows[0]

    // Unlock account
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, locked_until = NULL 
       WHERE id = $1`,
      [user.id],
    )

    logger.info(`Account unlocked by admin ${req.user.userId}:`, {
      targetUserId: user.id,
      targetEmail: user.email,
      adminId: req.user.userId,
    })

    res.json({
      success: true,
      message: `Account unlocked: ${user.email}`,
      data: {
        userId: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    logger.error('Unlock account error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to unlock account',
    })
  }
}

/**
 * Admin: Get lockout status for all locked accounts
 * GET /api/v1/admin/locked-accounts
 * Requires: admin or super_admin role
 */
export const getLockedAccounts = async (req: AuthRequest, res: Response) => {
  try {
    // Verify requester is admin
    if (
      !req.user ||
      (req.user.userType !== 'admin' && req.user.userType !== 'super_admin')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      })
    }

    const result = await query(
      `SELECT id, email, failed_login_attempts, locked_until, last_login
       FROM users 
       WHERE locked_until IS NOT NULL AND locked_until > NOW()
       ORDER BY locked_until DESC`,
    )

    res.json({
      success: true,
      data: {
        count: result.rows.length,
        lockedAccounts: result.rows.map((row) => ({
          userId: row.id,
          email: row.email,
          failedAttempts: row.failed_login_attempts,
          lockedUntil: row.locked_until,
          lastLogin: row.last_login,
        })),
      },
    })
  } catch (error) {
    logger.error('Get locked accounts error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locked accounts',
    })
  }
}

router.post('/unlock-account', authenticate, unlockUserAccount)
router.get('/locked-accounts', authenticate, getLockedAccounts)

export default router
