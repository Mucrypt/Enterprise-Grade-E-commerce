/**
 * Response DTOs for the commerce-channel API -- allowlist types, not raw
 * row passthroughs, following promotions/promotion.types.ts's
 * toSocialConnectionDto() pattern exactly: every field is named
 * explicitly, so access_token_encrypted/refresh_token_encrypted/
 * token_encryption_key_version are structurally absent from the return
 * type, not merely omitted by discipline.
 */
import { ChannelType } from '../../../services/channels/channel-account.types'

export interface CommerceChannelAccountDto {
  id: string
  channelType: ChannelType
  displayName: string | null
  externalShopId: string | null
  marketCountry: string
  marketCurrency: string
  status: string
  syncMode: string
  scopes: string[]
  connectedAt: string | null
  lastValidatedAt: string | null
  lastError: string | null
  disabledByAdmin: boolean
  accessTokenExpiresAt: string | null
  metadata: Record<string, unknown>
}

export function toCommerceChannelAccountDto(row: any): CommerceChannelAccountDto {
  return {
    id: row.id,
    channelType: row.channel_type,
    displayName: row.display_name,
    externalShopId: row.external_shop_id,
    marketCountry: row.market_country,
    marketCurrency: row.market_currency,
    status: row.status,
    syncMode: row.sync_mode,
    scopes: row.scopes || [],
    connectedAt: row.connected_at,
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
    disabledByAdmin: row.disabled_by_admin,
    accessTokenExpiresAt: row.access_token_expires_at,
    metadata: row.metadata || {},
    // Deliberately no access_token_encrypted / refresh_token_encrypted /
    // token_encryption_key_version / shop_cipher fields -- shop_cipher is
    // not a secret, but it's an internal API-call detail with no reason to
    // ever reach the browser either.
  }
}
