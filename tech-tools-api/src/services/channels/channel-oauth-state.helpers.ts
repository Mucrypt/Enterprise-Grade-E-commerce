/**
 * OAuth state storage for the commerce-channel connection flow
 * (TIKTOK-COMMERCE-1). Direct structural clone of
 * api/v1/promotions/promotion-oauth-state.helpers.ts (PROMOTION-OPS-1's
 * hardened Redis-backed OAuth state) -- same Redis-backed, single-use,
 * TTL-bounded, actor-bound, exact-redirect-match design, applied to a
 * different key prefix so the two domains' pending states can never
 * collide even if both flows happened to reuse the same random state
 * value (astronomically unlikely, but the separate prefix costs nothing).
 *
 * Each stored state carries the channel type, the exact redirectUri the
 * flow was started with (checked for an exact match again at callback, so
 * a callback can never complete against a different redirect target than
 * the one the authorize URL was actually built for), and the initiating
 * user's id (checked again at callback, so a state issued to user A can
 * never be completed as user B). No PKCE code_verifier -- TikTok Shop's
 * OAuth flow (unlike X's, in social-adapters/) does not use PKCE per any
 * source consulted.
 */
import { randomBytes } from 'crypto'
import getRedisClient from '../../config/redis'
import { ChannelType } from './channel-account.types'

export interface PendingChannelOAuthState {
  channelType: ChannelType
  userId: string
  redirectUri: string
}

const OAUTH_STATE_TTL_SECONDS = 10 * 60

function stateKey(state: string): string {
  return `commerce_channel_oauth_state:${state}`
}

export function generateChannelOAuthState(): string {
  return randomBytes(24).toString('hex')
}

export async function storeChannelOAuthState(state: string, pending: PendingChannelOAuthState): Promise<void> {
  const redisClient = getRedisClient()
  await redisClient.set(stateKey(state), JSON.stringify(pending), { EX: OAUTH_STATE_TTL_SECONDS })
}

/** One-time use -- deletes the entry on read regardless of what the caller does with the result. Returns null for an unknown, expired, or already-consumed state. */
export async function consumeChannelOAuthState(state: string): Promise<PendingChannelOAuthState | null> {
  const redisClient = getRedisClient()
  const key = stateKey(state)
  const raw = await redisClient.get(key)
  if (!raw) return null
  await redisClient.del(key)
  try {
    return JSON.parse(raw) as PendingChannelOAuthState
  } catch {
    return null
  }
}

/**
 * Fail-closed redirect-URI allowlist -- an empty/unconfigured
 * CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS means NO redirect URI is
 * accepted, not "anything goes." A founder must explicitly list the
 * admin-dashboard origin(s) before any channel OAuth flow can start at
 * all -- prevents an open-redirect/callback-substitution attack where a
 * caller supplies an arbitrary redirectUri and later receives the
 * exchanged connection response at a domain they control. Deliberately a
 * separate env var from SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS, even
 * though the admin origin value will likely be identical in practice --
 * the two domains' allowlists should never be silently coupled.
 */
export function isAllowedChannelRedirectOrigin(redirectUri: string): boolean {
  const allowedOrigins = (process.env.CHANNEL_OAUTH_ALLOWED_REDIRECT_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowedOrigins.length === 0) return false
  try {
    return allowedOrigins.includes(new URL(redirectUri).origin)
  } catch {
    return false
  }
}
