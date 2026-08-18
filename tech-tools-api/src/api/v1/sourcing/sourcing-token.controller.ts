/**
 * Extension API-token management (SOURCING-1). Issuing a durable
 * credential is a sensitive action -- gated sourcing.manage, never the
 * broader sourcing.import a token itself carries.
 */
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'
import { issueToken, listTokensForUser, revokeToken } from '../../../services/sourcing/sourcing-token.service'

export const issueSourcingToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, expiresInDays } = req.body
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: '"name" is required' })
      return
    }
    const result = await issueToken(req.user!.userId, name.trim(), typeof expiresInDays === 'number' ? expiresInDays : null)
    // The raw token is returned exactly once, here, and never again --
    // no subsequent list call ever includes it, only token_prefix.
    res.status(201).json({ success: true, data: { id: result.id, token: result.rawToken, tokenPrefix: result.tokenPrefix } })
  } catch (error) {
    logger.error('Error issuing sourcing API token:', error)
    res.status(500).json({ success: false, error: 'Failed to issue token' })
  }
}

export const listSourcingTokens = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tokens = await listTokensForUser(req.user!.userId)
    res.json({ success: true, tokens })
  } catch (error) {
    logger.error('Error listing sourcing API tokens:', error)
    res.status(500).json({ success: false, error: 'Failed to list tokens' })
  }
}

export const revokeSourcingToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const revoked = await revokeToken(req.params.id, req.user!.userId)
    if (!revoked) {
      res.status(404).json({ success: false, error: 'Token not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Error revoking sourcing API token:', error)
    res.status(500).json({ success: false, error: 'Failed to revoke token' })
  }
}
