/**
 * Shared adapter interface every platform-specific publisher implements.
 * The whole point of this file: nothing outside social-adapters/ should
 * ever branch on `if (platform === 'instagram')` -- every controller/queue
 * caller goes through getAdapter(platform) from registry.ts and calls the
 * same methods, regardless of which platform it actually is.
 */

export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'LINKEDIN' | 'PINTEREST' | 'X'

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'PINTEREST', 'X']

/**
 * Whether this adapter can actually be used right now, in THIS
 * environment/deployment -- never a claim about the platform's API in the
 * abstract.
 *
 * NOT_CONFIGURED   -- the SOCIAL_<PLATFORM>_ENABLED flag is off. The
 *                      founder has not decided to turn this connector on.
 * NEEDS_CREDENTIALS -- the flag is on but SOCIAL_<PLATFORM>_CLIENT_ID/
 *                      _CLIENT_SECRET are missing. No real developer app
 *                      has been registered/configured for this deployment.
 * AVAILABLE        -- flag on AND credentials present. Still does not mean
 *                      a founder has completed the platform's own app
 *                      review process where one is required (see
 *                      requiresAppReview) -- OAuth may still fail there.
 */
export type PlatformReadiness = 'NOT_CONFIGURED' | 'NEEDS_CREDENTIALS' | 'AVAILABLE'

export interface PlatformCapabilities {
  platform: SocialPlatform
  readiness: PlatformReadiness
  /** True if the platform's own API requires a completed app-review process before organic publishing works for arbitrary content, independent of whether this deployment's OAuth credentials exist. */
  requiresAppReview: boolean
  supportsText: boolean
  supportsImage: boolean
  supportsMultiImage: boolean
  supportsVideo: boolean
  supportsReelOrShort: boolean
  supportsLink: boolean
  supportsScheduling: boolean
  supportsPostMetrics: boolean
  supportsComments: boolean
  supportsDelete: boolean
  supportsEdit: boolean
  /** Human-readable, e.g. "200 calls/hour per page (Graph API standard tier)". Not enforced in code here -- informational for the Connections UI and adapter authors. */
  rateLimitNotes: string
  /** Human-readable, e.g. "Long-lived tokens ~60 days; must be refreshed before expiry." */
  tokenExpiryNotes: string
  /** Anything else worth surfacing honestly in the Connections UI -- e.g. free-tier API restrictions, review requirements, known limitations. */
  notes: string
}

export interface ConnectionCreds {
  connectionId: string
  /** Already-decrypted access token -- callers must decrypt via secret-encryption.ts before constructing this; adapters never see ciphertext or touch encryption directly. */
  accessToken: string
  externalAccountId: string | null
}

export interface OAuthExchangeInput {
  code: string
  redirectUri: string
  /** PKCE code verifier, where the platform's OAuth flow supports/requires it (see each adapter's buildAuthorizeUrl). */
  codeVerifier?: string
}

export interface ConnectedAccountInfo {
  externalAccountId: string
  displayName: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes: string[]
}

export interface ValidatePostInput {
  message: string
  hashtags: string[]
  mediaCount: number
  mediaTypes: ('image' | 'video')[]
  hasLink: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PublishInput {
  connection: ConnectionCreds
  message: string
  link?: string
  /** Opaque media references returned by a prior uploadMedia() call, in display order. */
  mediaRefs?: string[]
  dryRun: boolean
}

export interface PublishResult {
  remotePostId: string
  remotePermalink?: string
}

export interface PostStatusResult {
  /** Adapter-native status string (e.g. Facebook's own post status) -- surfaced as-is, not mapped onto this codebase's own enum, since the two don't correspond 1:1 across platforms. */
  status: string
  remotePermalink?: string
}

export interface MetricsResult {
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  clicks?: number
  /** Whatever else the platform returns that doesn't map to a named field above. Never fabricated -- a metric this platform's API doesn't return is simply absent, not zero. */
  raw?: Record<string, unknown>
}

export class PlatformNotConfiguredError extends Error {
  constructor(public platform: SocialPlatform, public readiness: PlatformReadiness) {
    super(`${platform} is not usable in this environment (${readiness}).`)
  }
}

/**
 * How a publish (or other real-network-call) failure should be handled by
 * the queue -- Production Review Round 1 §5.
 *
 * SAFE_TO_RETRY       -- the provider gave a definitive response (a real
 *                         HTTP status), and that response indicates a
 *                         transient condition (rate limit, 5xx). The
 *                         request was received and rejected/errored, not
 *                         silently dropped -- retrying cannot double-post.
 * DO_NOT_RETRY         -- the provider gave a definitive response
 *                         indicating a permanent condition (expired/
 *                         missing auth, invalid media/caption, account
 *                         restricted, app review required). Retrying
 *                         would fail identically forever.
 * REMOTE_STATE_UNKNOWN -- no definitive response was ever received (the
 *                         network call itself threw -- timeout, reset,
 *                         DNS failure, aborted connection). Whether the
 *                         provider received and processed the request
 *                         before the connection failed cannot be known
 *                         from here. Never auto-retried -- see
 *                         promotion-campaign.queue.ts's REQUIRES_ACTION
 *                         handling.
 */
export type PublishFailureClassification = 'SAFE_TO_RETRY' | 'DO_NOT_RETRY' | 'REMOTE_STATE_UNKNOWN'

export class PublishError extends Error {
  constructor(message: string, public classification: PublishFailureClassification, public errorCode: string) {
    super(message)
    this.name = 'PublishError'
  }
}

export interface SocialPublisherAdapter {
  platform: SocialPlatform

  getCapabilities(): PlatformCapabilities

  /**
   * Builds the platform's real, documented-shape OAuth authorization URL.
   * Throws PlatformNotConfiguredError if getCapabilities().readiness is not
   * 'AVAILABLE' -- never returns a URL for a connector this deployment
   * cannot actually complete an OAuth exchange for.
   */
  buildAuthorizeUrl(redirectUri: string, state: string, codeVerifier?: string): string

  exchangeCodeForToken(input: OAuthExchangeInput): Promise<ConnectedAccountInfo>

  validateConnection(accessToken: string): Promise<{ valid: boolean; reason?: string }>

  /** Pure, offline validation against this platform's known capability limits (caption length, media count, etc.) -- makes no network call. */
  validatePost(input: ValidatePostInput): ValidationResult

  uploadMedia(connection: ConnectionCreds, buffer: Buffer, mimeType: string): Promise<{ mediaRef: string }>

  /** A real, complete network call to the platform's publish endpoint. Never internally short-circuits for "dry run" -- that decision is made one layer up, by the caller (the queue worker), which only ever calls this method when a publish is genuinely meant to happen. */
  publish(input: PublishInput): Promise<PublishResult>

  getPostStatus(connection: ConnectionCreds, remotePostId: string): Promise<PostStatusResult>

  fetchMetrics(connection: ConnectionCreds, remotePostId: string): Promise<MetricsResult>

  deletePost?(connection: ConnectionCreds, remotePostId: string): Promise<void>

  refreshToken?(connection: ConnectionCreds): Promise<ConnectedAccountInfo>
}
