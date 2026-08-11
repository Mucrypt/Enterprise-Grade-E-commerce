/**
 * Pinterest adapter. Endpoint shapes verified against Pinterest's official
 * developer docs (developers.pinterest.com/docs/getting-started/
 * set-up-authentication-and-authorization) at implementation time.
 *
 * "Publishing" on Pinterest means creating a Pin on a specific board --
 * unlike the other 5 platforms, a board selection is a hard prerequisite,
 * not optional metadata; validatePost() reflects that explicitly.
 */
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

const AUTHORIZE_URL = 'https://www.pinterest.com/oauth/'
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token'
const API_BASE = 'https://api.pinterest.com/v5'

const MAX_TITLE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

export class PinterestAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'PINTEREST'
  protected envPrefix = 'PINTEREST'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true, // "Standard Access" trust-tier approval needed beyond basic app creation for production pin creation
    supportsText: false,
    supportsImage: true,
    supportsMultiImage: false, // a Pin is one image (or one video); no native multi-image carousel via this API
    supportsVideo: true,
    supportsReelOrShort: false,
    supportsLink: true, // the Pin's destination URL
    supportsScheduling: false,
    supportsPostMetrics: true,
    supportsComments: false,
    supportsDelete: true,
    supportsEdit: true,
    rateLimitNotes: '1,000 calls per app per day at Trial Access; higher tiers assigned after Pinterest approves a Standard/Advanced Access application.',
    tokenExpiryNotes: 'Access tokens ~30 days by default (extendable to ~1 year with continuous_refresh); refresh tokens available for renewing without re-authorization.',
    notes:
      'Every Pin must be created on a specific board -- there is no "post without a board" option. Production Pin creation requires Pinterest\'s Standard Access trust tier, a manual approval step beyond basic app registration.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string): string {
    this.assertAvailable()
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'boards:read,pins:read,pins:write',
      state,
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    const basicAuth = Buffer.from(`${this.requireClientId()}:${this.requireClientSecret()}`).toString('base64')
    const form = new URLSearchParams({
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    if (!res.ok) throw new Error(`Pinterest token exchange failed: HTTP ${res.status}`)
    const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
    return {
      externalAccountId: '',
      displayName: '',
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      scopes: body.scope ? body.scope.split(',') : [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/user_account`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.message || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    // message is used as the Pin description here; title truncation is
    // checked by the caller against the campaign's own title field, not
    // re-derived from message -- this validator only checks what it has.
    if (input.message.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description exceeds Pinterest's ${MAX_DESCRIPTION_LENGTH}-character limit.`)
    }
    if (input.mediaCount === 0) {
      errors.push('Pinterest Pins require exactly one image or video.')
    }
    if (input.mediaCount > 1) {
      errors.push('Pinterest Pins support only a single image or video via this API -- no multi-image carousel.')
    }
    if (!input.hasLink) {
      warnings.push('No destination link set -- the Pin will not drive traffic back to the store.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(): Promise<{ mediaRef: string }> {
    // Pinterest's Pin-creation endpoint takes a media source URL directly
    // (media_source.url) rather than a separate upload-then-reference
    // step -- same pattern as Instagram, folded into publish() instead of
    // a standalone uploadMedia().
    throw new Error('Pinterest publishing takes a public media URL directly via PublishInput -- call publish() rather than uploadMedia().')
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.mediaRefs || input.mediaRefs.length === 0) {
      throw new Error('Pinterest requires exactly one media URL to create a Pin.')
    }
    // The target board id is expected to be encoded as the connection's
    // externalAccountId for a Pinterest connection (one social_connections
    // row per board, matching how a founder actually organizes Pinterest
    // publishing -- one default board per connected account is a
    // reasonable v1 model; a per-post board picker is a later refinement).
    const body = {
      board_id: input.connection.externalAccountId,
      media_source: { source_type: 'image_url', url: input.mediaRefs[0] },
      link: input.link,
      description: input.message,
    }
    const res = await this.fetchOrThrow(
      `${API_BASE}/pins`,
      { method: 'POST', headers: { Authorization: `Bearer ${input.connection.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      'Pinterest publish',
    )
    const created = (await res.json()) as { id: string }
    return { remotePostId: created.id, remotePermalink: `https://www.pinterest.com/pin/${created.id}/` }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(`${API_BASE}/pins/${remotePostId}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    })
    if (!res.ok) return { status: `HTTP_${res.status}` }
    return { status: 'PUBLISHED', remotePermalink: `https://www.pinterest.com/pin/${remotePostId}/` }
  }

  async fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult> {
    const res = await fetch(
      `${API_BASE}/pins/${remotePostId}/analytics?metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`,
      { headers: { Authorization: `Bearer ${connection.accessToken}` } },
    )
    if (!res.ok) return {}
    const body = (await res.json()) as {
      all?: { summary_metrics?: { IMPRESSION?: number; SAVE?: number; PIN_CLICK?: number; OUTBOUND_CLICK?: number } }
    }
    const summary = body.all?.summary_metrics
    if (!summary) return {}
    return {
      impressions: summary.IMPRESSION,
      clicks: summary.OUTBOUND_CLICK,
      raw: summary as Record<string, unknown>,
    }
  }

  async deletePost(connection: ConnectionCreds, remotePostId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/pins/${remotePostId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    })
    if (!res.ok) throw new Error(`Pinterest delete failed: HTTP ${res.status}`)
  }
}
