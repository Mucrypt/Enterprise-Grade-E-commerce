/**
 * Facebook Pages adapter. Endpoint shapes verified against Meta's official
 * developer docs (developers.facebook.com/docs/facebook-login/guides/
 * advanced/manual-flow) at implementation time -- Graph API version pinned
 * below; re-verify before enabling in production, since Meta retires old
 * versions on a schedule.
 *
 * Organic Page posting (`/publish_pages` / `pages_manage_posts` scope)
 * requires Meta App Review for any app not in Development Mode -- this
 * adapter never claims readiness beyond what env-configured credentials
 * allow; a completed app review is a separate, unverifiable-from-here
 * precondition, called out in staticCapabilities.notes.
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

const GRAPH_API_VERSION = 'v25.0'
const AUTHORIZE_URL = 'https://www.facebook.com/v25.0/dialog/oauth'
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// Facebook does not publicly document a hard caption-length limit for Page
// posts (practically very large, ~63,206 chars per community reports, not
// an official documented number) -- validated loosely here rather than
// asserting a precise figure that can't be confirmed against an official
// source.
const MAX_MESSAGE_LENGTH = 63_000

export class FacebookAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'FACEBOOK'
  protected envPrefix = 'FACEBOOK'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true,
    supportsText: true,
    supportsImage: true,
    supportsMultiImage: true,
    supportsVideo: true,
    supportsReelOrShort: true,
    supportsLink: true,
    supportsScheduling: true,
    supportsPostMetrics: true,
    supportsComments: true,
    supportsDelete: true,
    supportsEdit: true,
    rateLimitNotes: 'Graph API standard tier: rate limited per app per hour, scales with app usage; see Meta\'s Graph API rate limiting docs for the current formula.',
    tokenExpiryNotes: 'Short-lived user tokens (~1-2h) must be exchanged for a long-lived Page access token (~60 days, effectively non-expiring while the Page exists and the integration stays active).',
    notes:
      'Organic Page posting requires Meta App Review (pages_manage_posts, pages_read_engagement) for any app outside Development Mode -- readiness here reflects only whether OAuth credentials are configured, not whether app review has been completed.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string): string {
    this.assertAvailable()
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list',
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      redirect_uri: input.redirectUri,
      code: input.code,
    })
    const res = await fetch(`${TOKEN_URL}?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`Facebook token exchange failed: HTTP ${res.status}`)
    }
    const body = (await res.json()) as { access_token: string; expires_in?: number; token_type?: string }

    // The Page identity/name is fetched separately (GET /me/accounts) in
    // the real flow, since a user token can manage multiple Pages and the
    // founder must pick one -- left to the calling controller to resolve
    // via a follow-up call, not hardcoded into this exchange step.
    return {
      externalAccountId: '',
      displayName: '',
      accessToken: body.access_token,
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : undefined,
      scopes: [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${GRAPH_BASE}/me?access_token=${encodeURIComponent(accessToken)}`)
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.error?.message || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (input.message.length > MAX_MESSAGE_LENGTH) {
      errors.push(`Message exceeds Facebook's practical length limit (${MAX_MESSAGE_LENGTH} characters).`)
    }
    if (input.mediaTypes.includes('video') && input.mediaCount > 1) {
      errors.push('Facebook Page posts support only one video per post.')
    }
    if (input.mediaCount === 0 && !input.message && !input.hasLink) {
      errors.push('Post must have a message, a link, or media.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(connection: ConnectionCreds, buffer: Buffer, mimeType: string): Promise<{ mediaRef: string }> {
    const form = new FormData()
    form.append('source', new Blob([buffer], { type: mimeType }))
    form.append('published', 'false')
    form.append('access_token', connection.accessToken)
    const res = await fetch(`${GRAPH_BASE}/${connection.externalAccountId}/photos`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`Facebook media upload failed: HTTP ${res.status}`)
    const body = (await res.json()) as { id: string }
    return { mediaRef: body.id }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const params = new URLSearchParams({
      message: input.message,
      access_token: input.connection.accessToken,
    })
    if (input.link) params.set('link', input.link)
    if (input.mediaRefs && input.mediaRefs.length > 0) {
      // Attaching previously-uploaded (unpublished) photo ids to a feed post.
      params.set(
        'attached_media',
        JSON.stringify(input.mediaRefs.map((ref) => ({ media_fbid: ref }))),
      )
    }
    const res = await fetch(`${GRAPH_BASE}/${input.connection.externalAccountId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}))
      throw new Error(`Facebook publish failed: ${(errorBody as any)?.error?.message || `HTTP ${res.status}`}`)
    }
    const body = (await res.json()) as { id: string }
    return { remotePostId: body.id, remotePermalink: `https://www.facebook.com/${body.id}` }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(
      `${GRAPH_BASE}/${remotePostId}?fields=permalink_url&access_token=${encodeURIComponent(connection.accessToken)}`,
    )
    if (!res.ok) return { status: `HTTP_${res.status}` }
    const body = (await res.json()) as { permalink_url?: string }
    return { status: 'PUBLISHED', remotePermalink: body.permalink_url }
  }

  async fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult> {
    const metrics = ['post_impressions', 'post_reactions_by_type_total', 'post_clicks']
    const res = await fetch(
      `${GRAPH_BASE}/${remotePostId}/insights?metric=${metrics.join(',')}&access_token=${encodeURIComponent(connection.accessToken)}`,
    )
    if (!res.ok) return {}
    const body = (await res.json()) as { data?: { name: string; values: { value: unknown }[] }[] }
    const raw: Record<string, unknown> = {}
    for (const row of body.data || []) {
      raw[row.name] = row.values?.[0]?.value
    }
    return {
      impressions: typeof raw.post_impressions === 'number' ? raw.post_impressions : undefined,
      raw,
    }
  }

  async deletePost(connection: ConnectionCreds, remotePostId: string): Promise<void> {
    const res = await fetch(
      `${GRAPH_BASE}/${remotePostId}?access_token=${encodeURIComponent(connection.accessToken)}`,
      { method: 'DELETE' },
    )
    if (!res.ok) throw new Error(`Facebook delete failed: HTTP ${res.status}`)
  }
}
