/**
 * TikTok adapter. Endpoint shapes verified against TikTok's official
 * developer docs (developers.tiktok.com/doc/login-kit-web and
 * /doc/oauth-user-access-token-management) at implementation time.
 *
 * TikTok's Content Posting API gates direct public posting behind a
 * separate audited approval on top of standard app review -- this
 * adapter's capability matrix says so explicitly (section 13 of the phase
 * spec: "if the app has not passed required platform review, do NOT claim
 * public posting works"). Readiness here only reflects whether OAuth
 * credentials are configured; it never implies posting is actually
 * unlocked.
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

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const API_BASE = 'https://open.tiktokapis.com/v2'

const MAX_CAPTION_LENGTH = 2200

export class TikTokAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'TIKTOK'
  protected envPrefix = 'TIKTOK'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true,
    supportsText: false, // caption only, no text-only post type
    supportsImage: true, // via the Photo Mode / Content Posting API
    supportsMultiImage: true,
    supportsVideo: true,
    supportsReelOrShort: true,
    supportsLink: false, // no clickable link in captions for organic posts
    supportsScheduling: false,
    supportsPostMetrics: true,
    supportsComments: false, // not exposed for posting-app scope this codebase targets
    supportsDelete: false,
    supportsEdit: false,
    rateLimitNotes: 'Content Posting API: daily post-count quota per app, exact value assigned per app during TikTok\'s review process -- not a fixed public number.',
    tokenExpiryNotes: 'Access token ~24h, refresh token ~365 days -- must implement refresh before the short access-token window expires.',
    notes:
      'Direct public posting via the Content Posting API requires TikTok to grant "Direct Post" audited access on top of standard app review -- until that is granted for a given app, publish() will fail with a permission error from TikTok\'s API rather than silently succeeding. Never presented in this codebase as working without that grant.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string, codeVerifier?: string): string {
    this.assertAvailable()
    const params = new URLSearchParams({
      client_key: this.requireClientId(),
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.upload',
      redirect_uri: redirectUri,
      state,
    })
    // TikTok requires PKCE for mobile/desktop apps; supplying it for the
    // web flow too is harmless and matches this codebase's general PKCE-
    // where-supported policy.
    if (codeVerifier) {
      params.set('code_challenge', codeVerifier)
      params.set('code_challenge_method', 'plain')
    }
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    const form = new URLSearchParams({
      client_key: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    })
    if (input.codeVerifier) form.set('code_verifier', input.codeVerifier)
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: form.toString(),
    })
    if (!res.ok) throw new Error(`TikTok token exchange failed: HTTP ${res.status}`)
    const body = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      open_id: string
      scope: string
    }
    return {
      externalAccountId: body.open_id,
      displayName: '',
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      scopes: body.scope ? body.scope.split(',') : [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/user/info/?fields=open_id,display_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.error?.message || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (input.message.length > MAX_CAPTION_LENGTH) {
      errors.push(`Caption exceeds TikTok's ${MAX_CAPTION_LENGTH}-character limit.`)
    }
    if (input.mediaCount === 0) {
      errors.push('TikTok requires a video (or, via Photo Mode, one or more images) -- text-only posts are not supported.')
    }
    if (input.mediaTypes.includes('video') && input.mediaCount > 1) {
      errors.push('TikTok supports only one video per post.')
    }
    if (input.hasLink) {
      warnings.push('TikTok organic captions do not support clickable links.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(): Promise<{ mediaRef: string }> {
    // TikTok's Content Posting API uses a direct "init then PUT the video
    // bytes to a provided upload URL" flow tied 1:1 to a single publish
    // call, not a reusable standalone media-upload step the way Facebook's
    // photo upload is -- so this adapter folds upload into publish()
    // instead of exposing a separate uploadMedia().
    throw new Error('TikTok upload is integrated into publish() (init-then-PUT flow) -- call publish() directly rather than uploadMedia().')
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.mediaRefs || input.mediaRefs.length === 0) {
      throw new Error('TikTok requires a video URL to publish (PULL_FROM_URL source).')
    }
    const initBody = {
      post_info: {
        title: input.message,
        privacy_level: 'PUBLIC_TO_EVERYONE',
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: input.mediaRefs[0],
      },
    }
    const res = await this.fetchOrThrow(
      `${API_BASE}/post/publish/video/init/`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${input.connection.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(initBody),
      },
      'TikTok publish init',
    )
    const body = (await res.json()) as { data: { publish_id: string } }
    // TikTok's publish is asynchronous -- publish_id must be polled via
    // getPostStatus() until it reports success and a real video id.
    return { remotePostId: body.data.publish_id }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(`${API_BASE}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: remotePostId }),
    })
    if (!res.ok) return { status: `HTTP_${res.status}` }
    const body = (await res.json()) as { data?: { status?: string } }
    return { status: body.data?.status || 'UNKNOWN' }
  }

  async fetchMetrics(): Promise<MetricsResult> {
    // TikTok's public Content Posting API (the scope this adapter
    // requests) does not expose post-level analytics -- that requires
    // separate Display API / TikTok for Business access this codebase does
    // not request. Honestly returns nothing rather than fabricating zeros.
    return {}
  }
}
