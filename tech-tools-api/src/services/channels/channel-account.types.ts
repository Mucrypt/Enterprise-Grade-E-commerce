/**
 * Shared types for the generic commerce-channel architecture
 * (TIKTOK-COMMERCE-1). Deliberately parallel to, but never sharing code or
 * data with, services/social-adapters/social-adapter.types.ts -- that file
 * covers organic social publishing (PROMOTION-OPS-1); this one covers
 * external sales-channel commerce (products/orders/inventory/finance).
 * Nothing here should ever import from or be imported by
 * social-adapters/.
 */

export type ChannelType = 'TIKTOK_SHOP'

export const CHANNEL_TYPES: ChannelType[] = ['TIKTOK_SHOP']

/**
 * Whether this channel adapter can actually be used right now, in THIS
 * environment/deployment -- never a claim about the channel's API in the
 * abstract. Mirrors social-adapter.types.ts's PlatformReadiness exactly.
 *
 * NOT_CONFIGURED    -- the CHANNEL_<TYPE>_ENABLED flag is off.
 * NEEDS_CREDENTIALS -- the flag is on but CHANNEL_<TYPE>_APP_KEY/_APP_SECRET
 *                      are missing.
 * AVAILABLE         -- flag on AND credentials present. Still does not mean
 *                      TikTok's own developer-app review is complete --
 *                      OAuth may still fail there (see requiresAppReview).
 */
export type ChannelReadiness = 'NOT_CONFIGURED' | 'NEEDS_CREDENTIALS' | 'AVAILABLE'

export interface ChannelCapabilities {
  channelType: ChannelType
  readiness: ChannelReadiness
  /** True if this channel's own platform requires a completed developer-app review before any real API access works, independent of whether this deployment's OAuth credentials exist. */
  requiresAppReview: boolean
  supportsProductRead: boolean
  supportsProductWrite: boolean
  supportsInventoryRead: boolean
  supportsInventoryWrite: boolean
  supportsOrderImport: boolean
  supportsFulfillmentWrite: boolean
  supportsFinanceSync: boolean
  supportsAffiliateSync: boolean
  /** Human-readable, e.g. "Sandbox: ~1,000 queries/hour (unverified, third-party-sourced -- re-check Partner Center)." */
  rateLimitNotes: string
  /** Human-readable, e.g. "Access token ~24h; refresh token ~365d (third-party-sourced, re-verify before production)." */
  tokenExpiryNotes: string
  /** Anything else worth surfacing honestly in the Connections UI. */
  notes: string
}

export interface ChannelConnectionCreds {
  channelAccountId: string
  /** Already-decrypted access token -- callers must decrypt via secret-encryption.ts's channelTokenCipher before constructing this; adapters never see ciphertext or touch encryption directly. */
  accessToken: string
  externalShopId: string | null
  shopCipher: string | null
}

export interface ChannelOAuthExchangeInput {
  code: string
  redirectUri: string
}

export interface ConnectedChannelAccountInfo {
  externalShopId: string
  shopCipher: string
  displayName: string
  marketCountry: string
  marketCurrency: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  scopes: string[]
}

export class ChannelNotConfiguredError extends Error {
  constructor(public channelType: ChannelType, public readiness: ChannelReadiness) {
    super(`${channelType} is not usable in this environment (${readiness}).`)
  }
}

/**
 * How a channel-sync network-call failure should be handled by a sync
 * worker -- identical model to social-adapter.types.ts's
 * PublishFailureClassification, reused by name (not by import) since this
 * is a genuinely separate domain that happens to need the same shape.
 *
 * SAFE_TO_RETRY       -- a definitive HTTP response indicating a transient
 *                         condition (rate limit, 5xx). The request was
 *                         received and errored, not silently dropped.
 * DO_NOT_RETRY         -- a definitive HTTP response indicating a permanent
 *                         condition (expired/missing auth, invalid
 *                         payload). Retrying would fail identically
 *                         forever.
 * REMOTE_STATE_UNKNOWN -- no definitive response was ever received (the
 *                         network call itself threw). Whether the channel
 *                         received and processed the request before the
 *                         connection failed cannot be known. Never
 *                         auto-retried.
 */
export type ChannelSyncFailureClassification = 'SAFE_TO_RETRY' | 'DO_NOT_RETRY' | 'REMOTE_STATE_UNKNOWN'

export class ChannelSyncError extends Error {
  constructor(
    message: string,
    public classification: ChannelSyncFailureClassification,
    public errorCode: string,
    /** Seconds from a 429 response's Retry-After header, if the channel supplied one -- authoritative over any computed backoff delay. See base-channel-adapter.ts's fetchOrThrowWithRetry(). */
    public retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ChannelSyncError'
  }
}

/**
 * The common contract every concrete channel adapter implements -- the
 * generic-architecture equivalent of social-adapters/'s
 * SocialPublisherAdapter interface. Only TIKTOK_SHOP exists this phase;
 * a future Amazon/eBay adapter implements this same interface rather than
 * requiring any caller (controllers, workers) to branch on channel type.
 * Grows incrementally as later build steps add product/order/inventory
 * sync -- not every method below is called by every build step yet.
 */
/**
 * Normalized, channel-agnostic product/SKU shape -- every concrete
 * adapter's fetchProducts() returns this, so channel-sync.service.ts's
 * diff logic never needs to know which channel it's talking to. One row
 * per SKU (not per product), since mapping/diffing happens at SKU
 * granularity.
 */
export interface ChannelProductSku {
  channelProductId: string
  productTitle: string
  productStatus: string
  channelSkuId: string
  sellerSku: string
  price: number | null
  currency: string | null
  /** NULL means the channel didn't report a stock figure for this SKU (never coerced to 0). */
  stock: number | null
}

/**
 * Normalized, channel-agnostic order line -- one per SKU sold within one
 * order. `channelProductMappingId` is resolved by the importer (not the
 * adapter), so this shape carries only what the channel itself reported.
 */
export interface ChannelOrderLine {
  channelSku: string
  channelProductId: string
  productTitle: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
}

/**
 * Normalized, channel-agnostic order -- every concrete adapter's
 * fetchOrders() returns this shape. Deliberately excludes any fee/
 * commission/settlement figure: order-search-style APIs generally don't
 * report those (that's Finance-API territory, a later build step) --
 * importOrders() in channel-sync.service.ts leaves those columns NULL
 * rather than guessing them from discount fields that mean something
 * different (a discount is not a platform fee).
 */
export interface ChannelOrder {
  channelOrderId: string
  /** Raw channel status string -- never coerced into TechTools' own order_status enum; different state machines. */
  channelOrderStatus: string
  buyerDisplayName: string | null
  buyerCountry: string | null
  currency: string
  grossAmount: number
  shippingFeeAmount: number | null
  taxAmount: number | null
  /** The channel's own last-modified timestamp for this order, if it reports one -- NULL if unsupplied. Used by importOrders() to detect and ignore a stale/out-of-order re-delivery rather than regressing a newer known status. Never guessed or derived from receipt order. */
  externalUpdatedAt: Date | null
  items: ChannelOrderLine[]
  rawPayload: Record<string, unknown>
}

/**
 * Production Review Round 1 (§23/§24): a paginated fetch must never present
 * a mid-pagination failure as if it were a clean, complete result -- doing
 * so risks the caller silently treating a partial page set as "everything,"
 * and (for orders specifically) advancing a sync checkpoint past orders
 * that were never actually fetched. `complete: false` means some pages
 * were never retrieved; `orders`/`skus` still contains whatever pages DID
 * succeed before the failure, since a real, already-fetched result should
 * never be discarded just because a later page failed.
 */
export interface FetchOrdersResult {
  orders: ChannelOrder[]
  complete: boolean
  error?: string
}

export interface ChannelAdapter {
  channelType: ChannelType

  getCapabilities(): ChannelCapabilities

  /** Throws ChannelNotConfiguredError if getCapabilities().readiness is not 'AVAILABLE'. */
  buildAuthorizeUrl(redirectUri: string, state: string): string

  exchangeCodeForToken(input: ChannelOAuthExchangeInput): Promise<ConnectedChannelAccountInfo>

  refreshAccessToken(
    refreshToken: string,
  ): Promise<Pick<ConnectedChannelAccountInfo, 'accessToken' | 'refreshToken' | 'accessTokenExpiresAt' | 'refreshTokenExpiresAt'>>

  fetchProducts(creds: ChannelConnectionCreds): Promise<ChannelProductSku[]>

  /** READ-ONLY. `sinceDate` bounds a reconciliation poll, not a historical backfill -- see channel-sync.service.ts's importOrders(). Never throws on a mid-pagination failure -- see FetchOrdersResult. */
  fetchOrders(creds: ChannelConnectionCreds, sinceDate: Date): Promise<FetchOrdersResult>
}
