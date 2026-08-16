/**
 * Commerce channel account connection management -- listing, the OAuth
 * start/callback exchange, disconnect, and disable. Direct structural
 * clone of promotions/social-connection.controller.ts's pattern, applied
 * to the unrelated commerce-channel domain (see channel-account.types.ts's
 * header comment for why the two are kept separate).
 */
import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import { getChannelAdapter, getAllChannelCapabilities } from '../../../services/channels/registry'
import { CHANNEL_TYPES, ChannelNotConfiguredError, ChannelType } from '../../../services/channels/channel-account.types'
import { channelTokenCipher } from '../../../utils/secret-encryption'
import { toCommerceChannelAccountDto } from './channel-dto.types'
import {
  consumeChannelOAuthState,
  generateChannelOAuthState,
  isAllowedChannelRedirectOrigin,
  storeChannelOAuthState,
} from '../../../services/channels/channel-oauth-state.helpers'

const CURRENCY_CODE_RE = /^[A-Z]{3}$/

export const listChannelAccounts = async (_req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, channel_type, display_name, external_shop_id, market_country, market_currency, status,
              sync_mode, scopes, connected_at, last_validated_at, last_error, disabled_by_admin,
              access_token_expires_at, metadata
       FROM commerce_channel_accounts ORDER BY channel_type ASC, created_at ASC`,
    )
    res.json({
      success: true,
      accounts: result.rows.map(toCommerceChannelAccountDto),
      capabilities: getAllChannelCapabilities(),
    })
  } catch (error) {
    logger.error('Error listing commerce channel accounts:', error)
    res.status(500).json({ success: false, error: 'Failed to list channel accounts' })
  }
}

export const getCapabilities = async (_req: StaffAuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, capabilities: getAllChannelCapabilities() })
}

export const startChannelOAuth = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const channelType = req.params.channelType?.toUpperCase() as ChannelType
    if (!CHANNEL_TYPES.includes(channelType)) {
      res.status(400).json({ success: false, error: 'Unknown channel type' })
      return
    }
    const { redirectUri } = req.body
    if (typeof redirectUri !== 'string' || !redirectUri) {
      res.status(400).json({ success: false, error: '"redirectUri" is required' })
      return
    }
    // Fail-closed allowlist -- checked BEFORE building any real authorize
    // URL, so a disallowed origin never even reaches the
    // channel-configured check below. Same pattern as PROMOTION-OPS-1's
    // hardened social OAuth flow.
    if (!isAllowedChannelRedirectOrigin(redirectUri)) {
      res.status(400).json({ success: false, error: 'redirectUri is not an allowed origin for this deployment.' })
      return
    }

    const adapter = getChannelAdapter(channelType)
    const state = generateChannelOAuthState()

    let authorizeUrl: string
    try {
      authorizeUrl = adapter.buildAuthorizeUrl(redirectUri, state)
    } catch (error) {
      if (error instanceof ChannelNotConfiguredError) {
        res.status(409).json({ success: false, error: error.message, readiness: error.readiness })
        return
      }
      throw error
    }

    // Bound into the stored state: the exact redirectUri and the
    // initiating user's id are both re-checked at completeChannelOAuth()
    // before any token exchange happens.
    await storeChannelOAuthState(state, { channelType, userId: req.user!.userId, redirectUri })
    res.json({ success: true, authorizeUrl, state })
  } catch (error) {
    logger.error('Error starting channel OAuth flow:', error)
    res.status(500).json({ success: false, error: 'Failed to start OAuth flow' })
  }
}

export const completeChannelOAuth = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { code, state, redirectUri, marketCurrency } = req.body
    if (typeof code !== 'string' || typeof state !== 'string' || typeof redirectUri !== 'string') {
      res.status(400).json({ success: false, error: '"code", "state", and "redirectUri" are required' })
      return
    }
    // The channel's shop market (country) comes back from TikTok itself
    // (see tiktok-shop.adapter.ts's exchangeCodeForToken), but no source
    // consulted found a shop-level currency field on that response --
    // rather than guess a currency from the country, the connecting staff
    // member confirms it explicitly here. Validated as a real ISO 4217
    // shape, never silently defaulted.
    if (typeof marketCurrency !== 'string' || !CURRENCY_CODE_RE.test(marketCurrency)) {
      res.status(400).json({ success: false, error: '"marketCurrency" is required and must be a 3-letter ISO 4217 code (e.g. "EUR").' })
      return
    }

    const pending = await consumeChannelOAuthState(state) // one-time use, regardless of outcome below
    if (!pending) {
      res.status(400).json({ success: false, error: 'Unknown or expired OAuth state -- start the connection flow again.' })
      return
    }

    // Actor binding -- a state issued to one staff member must never be
    // completable by another, even if they somehow obtained the state
    // value (e.g. a shared/misdirected callback URL).
    if (pending.userId !== req.user!.userId) {
      logger.warn(`[ChannelOAuth] OAuth state completion attempted by a different user than initiated it (channelType=${pending.channelType})`)
      res.status(403).json({ success: false, error: 'This connection attempt was not initiated by you.' })
      return
    }
    // redirectUri binding -- must exactly match what the authorize URL was
    // actually built with.
    if (pending.redirectUri !== redirectUri) {
      res.status(400).json({ success: false, error: 'redirectUri does not match the one used to start this connection.' })
      return
    }

    const adapter = getChannelAdapter(pending.channelType)
    const accountInfo = await adapter.exchangeCodeForToken({ code, redirectUri })

    const result = await query(
      `INSERT INTO commerce_channel_accounts
         (channel_type, display_name, external_shop_id, shop_cipher, market_country, market_currency, status,
          access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at,
          scopes, connected_by, connected_at, last_validated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONNECTED', $7, $8, $9, $10, $11, $12, now(), now())
       ON CONFLICT (channel_type, external_shop_id) WHERE external_shop_id IS NOT NULL DO UPDATE SET
         display_name = EXCLUDED.display_name,
         shop_cipher = EXCLUDED.shop_cipher,
         market_country = EXCLUDED.market_country,
         market_currency = EXCLUDED.market_currency,
         status = 'CONNECTED',
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         access_token_expires_at = EXCLUDED.access_token_expires_at,
         refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
         scopes = EXCLUDED.scopes,
         connected_by = EXCLUDED.connected_by,
         connected_at = now(),
         last_validated_at = now(),
         last_error = NULL,
         updated_at = now()
       RETURNING id, channel_type, display_name, external_shop_id, market_country, market_currency, status,
                 sync_mode, scopes, connected_at, last_validated_at, last_error, disabled_by_admin,
                 access_token_expires_at, metadata`,
      [
        pending.channelType,
        accountInfo.displayName || null,
        accountInfo.externalShopId || null,
        accountInfo.shopCipher || null,
        accountInfo.marketCountry,
        marketCurrency,
        channelTokenCipher.encryptSecret(accountInfo.accessToken),
        channelTokenCipher.encryptSecret(accountInfo.refreshToken),
        accountInfo.accessTokenExpiresAt,
        accountInfo.refreshTokenExpiresAt,
        accountInfo.scopes,
        pending.userId,
      ],
    )

    const account = result.rows[0]
    await query(
      `INSERT INTO channel_activity_log (channel_account_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'CHANNEL_CONNECTED', $3)`,
      [account.id, pending.userId, JSON.stringify({ channelType: pending.channelType })],
    )

    res.json({ success: true, account: toCommerceChannelAccountDto(account) })
  } catch (error) {
    logger.error('Error completing channel OAuth flow:', error)
    res.status(500).json({ success: false, error: 'Failed to complete OAuth flow' })
  }
}

export const disconnectChannelAccount = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `UPDATE commerce_channel_accounts
       SET status = 'DISCONNECTED', access_token_encrypted = NULL, refresh_token_encrypted = NULL, updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [req.params.id],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Channel account not found' })
      return
    }
    await query(
      `INSERT INTO channel_activity_log (channel_account_id, actor_user_id, action, metadata)
       VALUES ($1, $2, 'CHANNEL_DISCONNECTED', '{}')`,
      [req.params.id, req.user!.userId],
    )
    res.json({ success: true, message: 'Channel account disconnected.' })
  } catch (error) {
    logger.error('Error disconnecting channel account:', error)
    res.status(500).json({ success: false, error: 'Failed to disconnect' })
  }
}

export const disableChannelAccount = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const disabled = req.body.disabled !== false
    const result = await query(
      `UPDATE commerce_channel_accounts
       SET disabled_by_admin = $2,
           status = CASE WHEN $2 THEN 'DISABLED_BY_ADMIN'::commerce_channel_account_status ELSE status END,
           updated_at = now()
       WHERE id = $1 RETURNING id`,
      [req.params.id, disabled],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Channel account not found' })
      return
    }
    await query(
      `INSERT INTO channel_activity_log (channel_account_id, actor_user_id, action, metadata)
       VALUES ($1, $2, $3, '{}')`,
      [req.params.id, req.user!.userId, disabled ? 'CHANNEL_DISABLED' : 'CHANNEL_ENABLED'],
    )
    res.json({ success: true })
  } catch (error) {
    logger.error('Error updating channel account disabled state:', error)
    res.status(500).json({ success: false, error: 'Failed to update channel account' })
  }
}
