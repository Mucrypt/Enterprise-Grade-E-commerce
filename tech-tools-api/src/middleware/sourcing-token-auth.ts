/**
 * Extension personal-access-token auth (SOURCING-1) -- the browser
 * extension holds this one long-lived token instead of a JWT/refresh-
 * token session. Resolves the token to its owning staff user and sets
 * req.user identically to authenticate() (../middleware/auth.ts), so the
 * request flows through the exact same requirePermission('sourcing.import')
 * check every other route uses -- no parallel authorization system, and
 * revoking/demoting the owning user breaks the token automatically the
 * next time requirePermission resolves staff context.
 *
 * Used ONLY on POST /api/v1/sourcing/captures -- every other sourcing
 * route stays on the normal dashboard JWT authenticate(), since the
 * founder is already logged in there.
 */
import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { query } from '../database/connection'
import logger from '../utils/logger'
import { resolveToken } from '../services/sourcing/sourcing-token.service'

const GENERIC_AUTH_ERROR = 'Invalid or expired sourcing API token'

export const authenticateSourcingToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR })
    }

    const rawToken = authHeader.slice('Bearer '.length).trim()
    if (!rawToken) {
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR })
    }

    const resolved = await resolveToken(rawToken)
    if (!resolved) {
      // Deliberately the same generic message for missing/malformed/
      // unknown/revoked/expired -- never hints at which reason applied,
      // avoiding any token-hash-enumeration signal.
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR })
    }

    const userResult = await query(`SELECT id, email, user_type FROM users WHERE id = $1`, [resolved.userId])
    const user = userResult.rows[0]
    if (!user) {
      return res.status(401).json({ success: false, error: GENERIC_AUTH_ERROR })
    }

    req.user = { id: user.id, userId: user.id, email: user.email, userType: user.user_type }
    ;(req as any).sourcingTokenId = resolved.id

    next()
  } catch (error) {
    logger.error('[SourcingTokenAuth] Unexpected error:', error)
    res.status(500).json({ success: false, error: 'Authentication failed' })
  }
}
