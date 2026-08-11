/**
 * OAuth state/PKCE-verifier storage for the social-connection flow --
 * Production Review Round 1 §11/§12/§13.
 *
 * Previously an in-memory Map (single-process only, lost on restart).
 * Moved to Redis (already-connected infrastructure this codebase uses for
 * refresh tokens -- see middleware/auth.ts) so a connection attempt
 * survives a process restart mid-flow and is safe if the API ever runs as
 * more than one instance. Single-use (deleted on first read, regardless
 * of outcome) and TTL-bounded so a never-completed flow cannot accumulate.
 *
 * Each stored state carries the platform, PKCE code_verifier, the exact
 * redirectUri the flow was started with (§12 -- checked for an exact match
 * again at callback, so a callback can never complete against a different
 * redirect target than the one the authorize URL was actually built for),
 * and the initiating user's id (§13 -- checked again at callback, so a
 * state issued to user A can never be completed as user B).
 */
import { randomBytes } from 'crypto'
import getRedisClient from '../../../config/redis'
import { SocialPlatform } from '../../../services/social-adapters/social-adapter.types'

export interface PendingOAuthState {
  platform: SocialPlatform
  codeVerifier: string
  userId: string
  redirectUri: string
}

const OAUTH_STATE_TTL_SECONDS = 10 * 60

function stateKey(state: string): string {
  return `promotion_oauth_state:${state}`
}

export function generateOAuthState(): string {
  return randomBytes(24).toString('hex')
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export async function storeOAuthState(state: string, pending: PendingOAuthState): Promise<void> {
  const redisClient = getRedisClient()
  await redisClient.set(stateKey(state), JSON.stringify(pending), { EX: OAUTH_STATE_TTL_SECONDS })
}

/** One-time use -- deletes the entry on read regardless of what the caller does with the result. Returns null for an unknown, expired, or already-consumed state. */
export async function consumeOAuthState(state: string): Promise<PendingOAuthState | null> {
  const redisClient = getRedisClient()
  const key = stateKey(state)
  const raw = await redisClient.get(key)
  if (!raw) return null
  await redisClient.del(key)
  try {
    return JSON.parse(raw) as PendingOAuthState
  } catch {
    return null
  }
}

/**
 * Fail-closed redirect-URI allowlist (§12) -- an empty/unconfigured
 * SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS means NO redirect URI is
 * accepted, not "anything goes." A founder must explicitly list the
 * admin-dashboard origin(s) (e.g. https://admin.techtoolstore.com) before
 * any OAuth flow can start at all -- prevents an open-redirect/callback-
 * substitution attack where a caller supplies an arbitrary redirectUri
 * and later receives the exchanged connection response at a domain they
 * control.
 */
export function isAllowedRedirectOrigin(redirectUri: string): boolean {
  const allowedOrigins = (process.env.SOCIAL_OAUTH_ALLOWED_REDIRECT_ORIGINS || '')
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
