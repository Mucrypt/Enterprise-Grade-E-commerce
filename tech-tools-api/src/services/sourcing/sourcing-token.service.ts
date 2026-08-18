/**
 * Extension personal-access-token issuance/list/revoke (SOURCING-1). Raw
 * tokens are high-entropy (32 random bytes) and are hashed with SHA-256
 * for storage/lookup -- fast indexed comparison is appropriate here
 * (unlike bcrypt for a low-entropy user password) since the token itself
 * already carries all the entropy. The raw value is returned exactly
 * once, at issuance, and is never recoverable afterward -- matches this
 * codebase's existing "shown once" precedent (channelTokenCipher-backed
 * OAuth secrets are similarly never re-displayed).
 */
import { randomBytes, createHash } from 'crypto'
import { query } from '../../database/connection'

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export interface IssuedToken {
  id: string
  rawToken: string
  tokenPrefix: string
}

export async function issueToken(userId: string, name: string, expiresInDays?: number | null): Promise<IssuedToken> {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const tokenPrefix = rawToken.slice(0, 10)
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null

  const result = await query(
    `INSERT INTO sourcing_api_tokens (user_id, name, token_prefix, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, name, tokenPrefix, tokenHash, expiresAt],
  )

  return { id: result.rows[0].id, rawToken, tokenPrefix }
}

export async function listTokensForUser(userId: string): Promise<any[]> {
  const result = await query(
    `SELECT id, name, token_prefix, scopes, last_used_at, last_used_ip, expires_at, revoked_at, created_at
     FROM sourcing_api_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  )
  return result.rows
}

export async function revokeToken(tokenId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE sourcing_api_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [tokenId, userId],
  )
  return (result.rowCount ?? 0) > 0
}

/** Used only by the auth middleware -- resolves a raw token to its owning user, or null. */
export async function resolveToken(rawToken: string): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashToken(rawToken)
  const result = await query(
    `SELECT id, user_id FROM sourcing_api_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [tokenHash],
  )
  const row = result.rows[0]
  if (!row) return null

  // Fire-and-forget -- must never block or fail the auth check.
  query(`UPDATE sourcing_api_tokens SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {})

  return { id: row.id, userId: row.user_id }
}
