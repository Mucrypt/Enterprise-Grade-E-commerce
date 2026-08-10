/**
 * Shared request/response shapes for the promotion campaign + social
 * connection endpoints. Response DTOs are deliberately an allowlist (only
 * the fields listed here are ever sent), not a blacklist of a raw DB row --
 * this is what keeps access_token_encrypted/refresh_token_encrypted
 * structurally incapable of leaking into an API response, per
 * PROMOTION-OPS-1's token-security requirement.
 */
import { SocialPlatform } from '../../../services/social-adapters/social-adapter.types'

export interface SocialConnectionDto {
  id: string
  platform: SocialPlatform
  displayName: string | null
  externalAccountId: string | null
  status: string
  scopes: string[]
  connectedAt: string | null
  lastValidatedAt: string | null
  lastError: string | null
  disabledByAdmin: boolean
  tokenExpiresAt: string | null
  metadata: Record<string, unknown>
}

export function toSocialConnectionDto(row: any): SocialConnectionDto {
  return {
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    externalAccountId: row.external_account_id,
    status: row.status,
    scopes: row.scopes || [],
    connectedAt: row.connected_at,
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
    disabledByAdmin: row.disabled_by_admin,
    tokenExpiresAt: row.token_expires_at,
    metadata: row.metadata || {},
    // Deliberately no access_token_encrypted / refresh_token_encrypted /
    // token_encryption_key_version field -- allowlist, not blacklist.
  }
}
