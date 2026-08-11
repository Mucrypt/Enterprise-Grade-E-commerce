/**
 * Instagram adapter, using the direct "Instagram API with Instagram Login"
 * business-login flow (not the older Facebook-Login-mediated flow) --
 * endpoint shapes verified against Meta's official developer docs
 * (developers.facebook.com/docs/instagram-platform/instagram-api-with-
 * instagram-login/business-login) at implementation time.
 *
 * Organic content publishing requires a Professional (Business/Creator)
 * Instagram account and Meta App Review for the relevant permissions --
 * same caveat as facebook.adapter.ts: readiness here reflects only
 * whether OAuth credentials are configured.
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

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'
const GRAPH_BASE = 'https://graph.instagram.com'

// Publicly documented Instagram caption limit.
const MAX_CAPTION_LENGTH = 2200
const MAX_HASHTAGS = 30

export class InstagramAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'INSTAGRAM'
  protected envPrefix = 'INSTAGRAM'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true,
    supportsText: true,
    supportsImage: true,
    supportsMultiImage: true,
    supportsVideo: true,
    supportsReelOrShort: true,
    supportsLink: false, // no clickable link in the caption body itself
    supportsScheduling: false, // container-publish flow has no native "schedule for later"; this app schedules by holding the post and publishing at the right time instead
    supportsPostMetrics: true,
    supportsComments: true,
    supportsDelete: true,
    supportsEdit: false, // captions cannot be edited via the API after publish
    rateLimitNotes: 'Content Publishing API: 25 posts per rolling 24h window per Instagram account (Meta-documented limit).',
    tokenExpiryNotes: 'Short-lived token (~1h) must be exchanged for a long-lived token (~60 days) immediately via graph.instagram.com/access_token.',
    notes: 'Requires a Professional (Business or Creator) Instagram account and completed Meta App Review for content-publishing permissions.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string): string {
    this.assertAvailable()
    const params = new URLSearchParams({
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights',
      state,
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    const form = new URLSearchParams({
      client_id: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
    })
    const shortLivedRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!shortLivedRes.ok) throw new Error(`Instagram token exchange failed: HTTP ${shortLivedRes.status}`)
    const shortLived = (await shortLivedRes.json()) as { access_token: string; user_id: string }

    const longLivedParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.requireClientSecret(),
      access_token: shortLived.access_token,
    })
    const longLivedRes = await fetch(`${LONG_LIVED_TOKEN_URL}?${longLivedParams.toString()}`)
    if (!longLivedRes.ok) throw new Error(`Instagram long-lived token exchange failed: HTTP ${longLivedRes.status}`)
    const longLived = (await longLivedRes.json()) as { access_token: string; expires_in: number }

    return {
      externalAccountId: shortLived.user_id,
      displayName: '',
      accessToken: longLived.access_token,
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      scopes: [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${GRAPH_BASE}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`)
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.error?.message || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (input.message.length > MAX_CAPTION_LENGTH) {
      errors.push(`Caption exceeds Instagram's ${MAX_CAPTION_LENGTH}-character limit.`)
    }
    if (input.hashtags.length > MAX_HASHTAGS) {
      errors.push(`Instagram allows a maximum of ${MAX_HASHTAGS} hashtags per post.`)
    }
    if (input.mediaCount === 0) {
      errors.push('Instagram requires at least one image or video -- text-only posts are not supported.')
    }
    if (input.mediaCount > 10) {
      errors.push('Instagram carousel posts support a maximum of 10 items.')
    }
    if (input.hasLink) {
      warnings.push('Instagram captions do not support clickable links -- the link will only be visible as plain text.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(connection: ConnectionCreds, buffer: Buffer, mimeType: string): Promise<{ mediaRef: string }> {
    // Instagram's Content Publishing API takes a publicly reachable image
    // URL, not a raw upload -- the caller is expected to have already
    // stored the creative via media-storage.service.ts and pass that URL
    // through PublishInput; this method exists to satisfy the shared
    // interface but is a no-op passthrough for Instagram specifically.
    void connection
    void buffer
    void mimeType
    throw new Error(
      'Instagram publishing takes a public media URL directly, not a raw upload -- pass the already-stored creative URL via PublishInput instead of calling uploadMedia() for this platform.',
    )
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.mediaRefs || input.mediaRefs.length === 0) {
      throw new Error('Instagram requires at least one media URL to publish.')
    }
    const isCarousel = input.mediaRefs.length > 1
    const containerIds: string[] = []

    for (const mediaUrl of input.mediaRefs) {
      const containerParams = new URLSearchParams({
        image_url: mediaUrl,
        access_token: input.connection.accessToken,
      })
      if (!isCarousel) containerParams.set('caption', input.message)
      if (isCarousel) containerParams.set('is_carousel_item', 'true')
      const containerRes = await this.fetchOrThrow(
        `${GRAPH_BASE}/${input.connection.externalAccountId}/media`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: containerParams.toString() },
        'Instagram media container creation',
      )
      const container = (await containerRes.json()) as { id: string }
      containerIds.push(container.id)
    }

    let publishContainerId = containerIds[0]
    if (isCarousel) {
      const carouselParams = new URLSearchParams({
        media_type: 'CAROUSEL',
        caption: input.message,
        children: containerIds.join(','),
        access_token: input.connection.accessToken,
      })
      const carouselRes = await this.fetchOrThrow(
        `${GRAPH_BASE}/${input.connection.externalAccountId}/media`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: carouselParams.toString() },
        'Instagram carousel container creation',
      )
      publishContainerId = ((await carouselRes.json()) as { id: string }).id
    }

    const publishParams = new URLSearchParams({
      creation_id: publishContainerId,
      access_token: input.connection.accessToken,
    })
    const publishRes = await this.fetchOrThrow(
      `${GRAPH_BASE}/${input.connection.externalAccountId}/media_publish`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: publishParams.toString() },
      'Instagram publish',
    )
    const published = (await publishRes.json()) as { id: string }
    return { remotePostId: published.id }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(
      `${GRAPH_BASE}/${remotePostId}?fields=permalink&access_token=${encodeURIComponent(connection.accessToken)}`,
    )
    if (!res.ok) return { status: `HTTP_${res.status}` }
    const body = (await res.json()) as { permalink?: string }
    return { status: 'PUBLISHED', remotePermalink: body.permalink }
  }

  async fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult> {
    const metrics = ['impressions', 'reach', 'likes', 'comments', 'shares']
    const res = await fetch(
      `${GRAPH_BASE}/${remotePostId}/insights?metric=${metrics.join(',')}&access_token=${encodeURIComponent(connection.accessToken)}`,
    )
    if (!res.ok) return {}
    const body = (await res.json()) as { data?: { name: string; values: { value: unknown }[] }[] }
    const raw: Record<string, unknown> = {}
    for (const row of body.data || []) raw[row.name] = row.values?.[0]?.value
    return {
      impressions: typeof raw.impressions === 'number' ? raw.impressions : undefined,
      reach: typeof raw.reach === 'number' ? raw.reach : undefined,
      likes: typeof raw.likes === 'number' ? raw.likes : undefined,
      comments: typeof raw.comments === 'number' ? raw.comments : undefined,
      shares: typeof raw.shares === 'number' ? raw.shares : undefined,
      raw,
    }
  }
}
