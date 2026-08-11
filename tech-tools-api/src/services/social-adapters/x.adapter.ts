/**
 * X (formerly Twitter) adapter. Endpoint shapes verified against X's
 * official developer docs (docs.x.com/fundamentals/authentication/
 * oauth-2-0/user-access-token) at implementation time.
 *
 * X's OAuth 2.0 flow requires PKCE (code_challenge/code_verifier) --
 * unlike the other 5 platforms, codeVerifier is not optional here;
 * buildAuthorizeUrl throws if one is not supplied.
 *
 * X's free API tier historically has severe posting-volume restrictions
 * (as low as tens of posts per month on some tiers) -- this is called out
 * explicitly in staticCapabilities.notes rather than assumed away, since
 * "app review required" undersells the real constraint here (it's a
 * paid-tier/quota problem, not an approval-workflow problem).
 */
import crypto from 'crypto'
import { BaseSocialAdapter, StaticCapabilities } from './base-social-adapter'
import {
  ConnectedAccountInfo,
  ConnectionCreds,
  MetricsResult,
  OAuthExchangeInput,
  PostStatusResult,
  PublishInput,
  PublishResult,
  SocialPlatform,
  ValidatePostInput,
  ValidationResult,
} from './social-adapter.types'

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const API_BASE = 'https://api.x.com/2'

const MAX_TEXT_LENGTH = 280

export class XAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'X'
  protected envPrefix = 'X'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: false, // no discretionary content-review gate like the other platforms
    supportsText: true,
    supportsImage: true,
    supportsMultiImage: true,
    supportsVideo: true,
    supportsReelOrShort: false,
    supportsLink: true,
    supportsScheduling: false,
    supportsPostMetrics: true,
    supportsComments: false,
    supportsDelete: true,
    supportsEdit: false,
    rateLimitNotes: 'Severely tier-dependent -- the free API tier has historically allowed as few as tens of posts per month per app; production use requires a paid API tier for any real posting volume.',
    tokenExpiryNotes: 'Access tokens ~2h; refresh tokens available (offline.access scope) for renewing without re-authorization.',
    notes:
      'Requires PKCE (code_challenge/code_verifier) on every OAuth exchange -- not optional. The free API tier\'s posting-volume limits are the practical blocker for most deployments, not an approval workflow like the other 5 platforms.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string, codeVerifier?: string): string {
    this.assertAvailable()
    if (!codeVerifier) {
      throw new Error('X requires a PKCE code_verifier for every authorization request.')
    }
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    if (!input.codeVerifier) {
      throw new Error('X token exchange requires the original PKCE code_verifier.')
    }
    const basicAuth = Buffer.from(`${this.requireClientId()}:${this.requireClientSecret()}`).toString('base64')
    const form = new URLSearchParams({
      code: input.code,
      grant_type: 'authorization_code',
      client_id: this.requireClientId(),
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    if (!res.ok) throw new Error(`X token exchange failed: HTTP ${res.status}`)
    const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
    return {
      externalAccountId: '',
      displayName: '',
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      scopes: body.scope ? body.scope.split(' ') : [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.detail || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (input.message.length > MAX_TEXT_LENGTH) {
      errors.push(`Post text exceeds X's ${MAX_TEXT_LENGTH}-character limit.`)
    }
    if (input.mediaCount > 4) {
      errors.push('X posts support a maximum of 4 images (or 1 video/GIF).')
    }
    if (input.mediaTypes.includes('video') && input.mediaCount > 1) {
      errors.push('X supports only one video per post.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(connection: ConnectionCreds, buffer: Buffer, mimeType: string): Promise<{ mediaRef: string }> {
    // X's v2 media upload endpoint (api.x.com/2/media/upload) -- simple
    // (non-chunked) path, appropriate for the image-only creative pipeline
    // this phase ships (see media/creative strategy in the implementation
    // report -- video/chunked upload is a documented next-phase item).
    const form = new FormData()
    form.append('media', new Blob([buffer], { type: mimeType }))
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.accessToken}` },
      body: form,
    })
    if (!res.ok) throw new Error(`X media upload failed: HTTP ${res.status}`)
    const body = (await res.json()) as { data: { id: string } }
    return { mediaRef: body.data.id }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const text = input.link ? `${input.message}\n\n${input.link}` : input.message
    const body: Record<string, unknown> = { text }
    if (input.mediaRefs && input.mediaRefs.length > 0) {
      body.media = { media_ids: input.mediaRefs }
    }
    const res = await this.fetchOrThrow(
      `${API_BASE}/tweets`,
      { method: 'POST', headers: { Authorization: `Bearer ${input.connection.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      'X publish',
    )
    const created = (await res.json()) as { data: { id: string } }
    return { remotePostId: created.data.id, remotePermalink: `https://x.com/i/web/status/${created.data.id}` }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(`${API_BASE}/tweets/${remotePostId}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    })
    if (!res.ok) return { status: `HTTP_${res.status}` }
    return { status: 'PUBLISHED', remotePermalink: `https://x.com/i/web/status/${remotePostId}` }
  }

  async fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult> {
    const res = await fetch(
      `${API_BASE}/tweets/${remotePostId}?tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${connection.accessToken}` } },
    )
    if (!res.ok) return {}
    const body = (await res.json()) as {
      data?: { public_metrics?: { impression_count?: number; like_count?: number; reply_count?: number; retweet_count?: number } }
    }
    const metrics = body.data?.public_metrics
    if (!metrics) return {}
    return {
      impressions: metrics.impression_count,
      likes: metrics.like_count,
      comments: metrics.reply_count,
      shares: metrics.retweet_count,
      raw: metrics as Record<string, unknown>,
    }
  }

  async deletePost(connection: ConnectionCreds, remotePostId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tweets/${remotePostId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    })
    if (!res.ok) throw new Error(`X delete failed: HTTP ${res.status}`)
  }
}
