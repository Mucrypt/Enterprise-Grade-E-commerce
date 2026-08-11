/**
 * Social account connection management -- listing, the OAuth start/
 * callback exchange, disconnect, and disable. Deliberately separate from
 * promotion-campaign.controller.ts: "posting content" and "connecting
 * company accounts" are different privileges (social.publish vs
 * social.accounts.manage), enforced at the route layer in
 * social-connection.routes.ts, not here.
 */
import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import { getAdapter, getAllCapabilities } from '../../../services/social-adapters/registry'
import { PlatformNotConfiguredError, SOCIAL_PLATFORMS, SocialPlatform } from '../../../services/social-adapters/social-adapter.types'
import { encryptSecret } from '../../../utils/secret-encryption'
import { toSocialConnectionDto } from './promotion.types'
import {
  consumeOAuthState,
  generateCodeVerifier,
  generateOAuthState,
  isAllowedRedirectOrigin,
  storeOAuthState,
} from './promotion-oauth-state.helpers'

export const listConnections = async (_req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, platform, display_name, external_account_id, status, scopes, connected_at,
              last_validated_at, last_error, disabled_by_admin, token_expires_at, metadata
       FROM social_connections ORDER BY platform ASC, created_at ASC`,
    )
    const capabilities = getAllCapabilities()
    res.json({
      success: true,
      connections: result.rows.map(toSocialConnectionDto),
      capabilities,
    })
  } catch (error) {
    logger.error('Error listing social connections:', error)
    res.status(500).json({ success: false, error: 'Failed to list connections' })
  }
}

export const getCapabilities = async (_req: StaffAuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, capabilities: getAllCapabilities() })
}

export const startOAuth = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const platform = req.params.platform?.toUpperCase() as SocialPlatform
    if (!SOCIAL_PLATFORMS.includes(platform)) {
      res.status(400).json({ success: false, error: 'Unknown platform' })
      return
    }
    const { redirectUri } = req.body
    if (typeof redirectUri !== 'string' || !redirectUri) {
      res.status(400).json({ success: false, error: '"redirectUri" is required' })
      return
    }
    // Fail-closed allowlist (Production Review Round 1 §12) -- prevents an
    // open-redirect/callback-substitution attack where a caller supplies
    // an arbitrary redirectUri. Checked BEFORE building any real
    // authorize URL, so a disallowed origin never even reaches the
    // platform-configured check below.
    if (!isAllowedRedirectOrigin(redirectUri)) {
      res.status(400).json({ success: false, error: 'redirectUri is not an allowed origin for this deployment.' })
      return
    }

    const adapter = getAdapter(platform)
    const state = generateOAuthState()
    const codeVerifier = generateCodeVerifier()

    let authorizeUrl: string
    try {
      authorizeUrl = adapter.buildAuthorizeUrl(redirectUri, state, codeVerifier)
    } catch (error) {
      if (error instanceof PlatformNotConfiguredError) {
        res.status(409).json({ success: false, error: error.message, readiness: error.readiness })
        return
      }
      throw error
    }

    // Bound into the stored state (§12/§13): the exact redirectUri and the
    // initiating user's id are both re-checked at completeOAuth() before
    // any token exchange happens.
    await storeOAuthState(state, { platform, codeVerifier, userId: req.user!.userId, redirectUri })
    res.json({ success: true, authorizeUrl, state })
  } catch (error) {
    logger.error('Error starting social OAuth flow:', error)
    res.status(500).json({ success: false, error: 'Failed to start OAuth flow' })
  }
}

export const completeOAuth = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { code, state, redirectUri } = req.body
    if (typeof code !== 'string' || typeof state !== 'string' || typeof redirectUri !== 'string') {
      res.status(400).json({ success: false, error: '"code", "state", and "redirectUri" are required' })
      return
    }

    const pending = await consumeOAuthState(state) // one-time use, regardless of outcome below
    if (!pending) {
      res.status(400).json({ success: false, error: 'Unknown or expired OAuth state -- start the connection flow again.' })
      return
    }

    // Actor binding (§13) -- a state issued to one staff member must never
    // be completable by another, even if they somehow obtained the state
    // value (e.g. a shared/misdirected callback URL).
    if (pending.userId !== req.user!.userId) {
      logger.warn(`[SocialOAuth] OAuth state completion attempted by a different user than initiated it (platform=${pending.platform})`)
      res.status(403).json({ success: false, error: 'This connection attempt was not initiated by you.' })
      return
    }
    // redirectUri binding (§12) -- must exactly match what the authorize
    // URL was actually built with; prevents completing the exchange
    // against a different redirect target than the one this state was
    // issued for.
    if (pending.redirectUri !== redirectUri) {
      res.status(400).json({ success: false, error: 'redirectUri does not match the one used to start this connection.' })
      return
    }

    const adapter = getAdapter(pending.platform)
    const accountInfo = await adapter.exchangeCodeForToken({ code, redirectUri, codeVerifier: pending.codeVerifier })

    const result = await query(
      `INSERT INTO social_connections
         (platform, display_name, external_account_id, status, access_token_encrypted, refresh_token_encrypted,
          token_expires_at, scopes, connected_by, connected_at, last_validated_at)
       VALUES ($1, $2, $3, 'CONNECTED', $4, $5, $6, $7, $8, now(), now())
       ON CONFLICT (platform, external_account_id) WHERE external_account_id IS NOT NULL DO UPDATE SET
         display_name = EXCLUDED.display_name,
         status = 'CONNECTED',
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes,
         connected_by = EXCLUDED.connected_by,
         connected_at = now(),
         last_validated_at = now(),
         last_error = NULL,
         updated_at = now()
       RETURNING id, platform, display_name, external_account_id, status, scopes, connected_at,
                 last_validated_at, last_error, disabled_by_admin, token_expires_at, metadata`,
      [
        pending.platform,
        accountInfo.displayName || null,
        accountInfo.externalAccountId || null,
        encryptSecret(accountInfo.accessToken),
        accountInfo.refreshToken ? encryptSecret(accountInfo.refreshToken) : null,
        accountInfo.expiresAt || null,
        accountInfo.scopes,
        pending.userId,
      ],
    )

    // promotion_activity_log requires a campaign_id (NOT NULL) --
    // account-connection events are not campaign-scoped, so they are not
    // logged there. social_connections' own connected_at/connected_by/
    // last_validated_at/last_error columns are this event's audit trail
    // instead. Noted here as a deliberate decision, not an oversight.

    res.json({ success: true, connection: toSocialConnectionDto(result.rows[0]) })
  } catch (error) {
    logger.error('Error completing social OAuth flow:', error)
    res.status(500).json({ success: false, error: 'Failed to complete OAuth flow' })
  }
}

export const disconnectConnection = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `UPDATE social_connections
       SET status = 'DISCONNECTED', access_token_encrypted = NULL, refresh_token_encrypted = NULL, updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [req.params.id],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Connection not found' })
      return
    }
    res.json({ success: true, message: 'Connection disconnected.' })
  } catch (error) {
    logger.error('Error disconnecting social connection:', error)
    res.status(500).json({ success: false, error: 'Failed to disconnect' })
  }
}

export const disableConnection = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `UPDATE social_connections SET disabled_by_admin = $2, status = CASE WHEN $2 THEN 'DISABLED_BY_ADMIN'::social_connection_status ELSE status END, updated_at = now()
       WHERE id = $1 RETURNING id`,
      [req.params.id, req.body.disabled !== false],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Connection not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Error updating social connection disabled state:', error)
    res.status(500).json({ success: false, error: 'Failed to update connection' })
  }
}
