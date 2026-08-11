/**
 * LinkedIn Organization Page adapter. Endpoint shapes verified against
 * LinkedIn's official developer docs (learn.microsoft.com/en-us/linkedin/
 * shared/authentication/authorization-code-flow) at implementation time.
 *
 * Posting on behalf of a LinkedIn Organization Page requires the "Share on
 * LinkedIn" / "Community Management API" product to be granted to the app
 * (a manual LinkedIn approval step, not automatic) -- same "readiness
 * reflects credentials only, not platform approval" caveat as every other
 * adapter here.
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

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const API_BASE = 'https://api.linkedin.com/rest'
const LINKEDIN_API_VERSION = '202601' // re-verify against LinkedIn's currently-supported version list before enabling

// LinkedIn's documented organic-post character limit (commonly cited as
// ~3000, not published as a single authoritative number in the OAuth doc
// fetched for this phase) -- validated loosely, flagged for reconfirmation
// against the Posts API docs specifically before going live.
const MAX_TEXT_LENGTH = 3000

export class LinkedInAdapter extends BaseSocialAdapter {
  platform: SocialPlatform = 'LINKEDIN'
  protected envPrefix = 'LINKEDIN'
  protected staticCapabilities: StaticCapabilities = {
    requiresAppReview: true,
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
    rateLimitNotes: 'Community Management API: application-level daily throttle assigned per app during LinkedIn\'s partner program review -- not a fixed public number.',
    tokenExpiryNotes: 'Access tokens ~60 days; LinkedIn does not issue long-lived tokens beyond that -- re-authorization or a partner-program refresh-token grant is required before expiry.',
    notes:
      'Posting to an Organization Page requires the "Community Management API" product to be granted to the app (LinkedIn Partner Program approval), separate from and in addition to standard OAuth app registration.',
  }

  buildAuthorizeUrl(redirectUri: string, state: string): string {
    this.assertAvailable()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.requireClientId(),
      redirect_uri: redirectUri,
      state,
      scope: 'w_member_social,r_organization_social,w_organization_social,rw_organization_admin',
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo> {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      client_id: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      redirect_uri: input.redirectUri,
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!res.ok) throw new Error(`LinkedIn token exchange failed: HTTP ${res.status}`)
    const body = (await res.json()) as { access_token: string; expires_in: number; scope?: string }
    return {
      externalAccountId: '',
      displayName: '',
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      scopes: body.scope ? body.scope.split(' ') : [],
    }
  }

  async validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/organizationAcls?q=roleAssignee`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
      },
    })
    if (res.ok) return { valid: true }
    const body = await res.json().catch(() => ({}))
    return { valid: false, reason: (body as any)?.message || `HTTP ${res.status}` }
  }

  validatePost(input: ValidatePostInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (input.message.length > MAX_TEXT_LENGTH) {
      errors.push(`Post text exceeds LinkedIn's practical ${MAX_TEXT_LENGTH}-character limit.`)
    }
    if (input.mediaTypes.includes('video') && input.mediaCount > 1) {
      errors.push('LinkedIn supports only one video per post.')
    }
    return { valid: errors.length === 0, errors, warnings }
  }

  async uploadMedia(connection: ConnectionCreds, buffer: Buffer, mimeType: string): Promise<{ mediaRef: string }> {
    const initRes = await fetch(`${API_BASE}/images?action=initializeUpload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: connection.externalAccountId } }),
    })
    if (!initRes.ok) throw new Error(`LinkedIn image upload init failed: HTTP ${initRes.status}`)
    const init = (await initRes.json()) as { value: { uploadUrl: string; image: string } }

    const uploadRes = await fetch(init.value.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: new Uint8Array(buffer),
    })
    if (!uploadRes.ok) throw new Error(`LinkedIn image binary upload failed: HTTP ${uploadRes.status}`)

    return { mediaRef: init.value.image }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const body: Record<string, unknown> = {
      author: input.connection.externalAccountId,
      commentary: input.message,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
    }
    if (input.mediaRefs && input.mediaRefs.length > 0) {
      body.content = { media: { id: input.mediaRefs[0] } }
    } else if (input.link) {
      body.content = { article: { source: input.link } }
    }

    const res = await this.fetchOrThrow(
      `${API_BASE}/posts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.connection.accessToken}`,
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      },
      'LinkedIn publish',
    )
    // LinkedIn returns the created post's URN in the x-restli-id response header, not a JSON body.
    const postUrn = res.headers.get('x-restli-id') || res.headers.get('X-RestLi-Id') || ''
    return { remotePostId: postUrn }
  }

  async getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult> {
    const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(remotePostId)}`, {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
      },
    })
    if (!res.ok) return { status: `HTTP_${res.status}` }
    const body = (await res.json()) as { lifecycleState?: string }
    return { status: body.lifecycleState || 'UNKNOWN' }
  }

  async fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult> {
    const res = await fetch(
      `${API_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(
        connection.externalAccountId || '',
      )}&shares[0]=${encodeURIComponent(remotePostId)}`,
      {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          'LinkedIn-Version': LINKEDIN_API_VERSION,
        },
      },
    )
    if (!res.ok) return {}
    const body = (await res.json()) as {
      elements?: { totalShareStatistics?: { impressionCount?: number; clickCount?: number; likeCount?: number; commentCount?: number; shareCount?: number } }[]
    }
    const stats = body.elements?.[0]?.totalShareStatistics
    if (!stats) return {}
    return {
      impressions: stats.impressionCount,
      clicks: stats.clickCount,
      likes: stats.likeCount,
      comments: stats.commentCount,
      shares: stats.shareCount,
      raw: stats as Record<string, unknown>,
    }
  }

  async deletePost(connection: ConnectionCreds, remotePostId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(remotePostId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'LinkedIn-Version': LINKEDIN_API_VERSION,
      },
    })
    if (!res.ok) throw new Error(`LinkedIn delete failed: HTTP ${res.status}`)
  }
}
