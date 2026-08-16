/**
 * TikTok Shop Partner Center commerce-API adapter. Phase 1
 * (TIKTOK-COMMERCE-1) implements only what read-only/diff-mode sync
 * needs: OAuth connect/refresh, authorized-shop lookup, and read calls for
 * products/orders/inventory added incrementally as their respective build
 * steps land. No write method exists anywhere in this file -- there is
 * nothing to gate behind a dry-run flag because nothing here can mutate
 * TikTok Shop state.
 *
 * Base URLs, endpoint paths, and parameter names below are sourced from
 * official-domain search results plus corroborating third-party
 * integration guides -- Partner Center's own documentation site is a
 * JS-rendered SPA that returns only truncated content to automated fetch
 * tools, so none of this has been verified against a raw primary-source
 * code sample or real test vectors. Every exact path/param name is flagged
 * inline where uncertain. Re-verify against Partner Center directly (and
 * ideally TikTok's own Postman collection) once real developer credentials
 * exist, BEFORE this adapter is ever pointed at a live TikTok Shop app --
 * see docs/TIKTOK-SHOP-COMMERCE-ARCHITECTURE.md.
 */
import { BaseChannelAdapter, StaticChannelCapabilities } from '../base-channel-adapter'
import { ChannelAdapter, ChannelConnectionCreds, ChannelOAuthExchangeInput, ChannelProductSku, ChannelType, ConnectedChannelAccountInfo, FetchOrdersResult } from '../channel-account.types'
import { signTikTokShopRequest } from './tiktok-shop.signing'
import {
  flattenTikTokShopOrder,
  flattenTikTokShopProducts,
  TIKTOK_SHOP_API_BASE_URL,
  TIKTOK_SHOP_AUTH_BASE_URL,
  TikTokShopAuthorizedShopsResponse,
  TikTokShopOrderSearchResponse,
  TikTokShopProductSearchResponse,
  TikTokShopTokenResponse,
} from './tiktok-shop.types'

const PRODUCT_SEARCH_PAGE_SIZE = 100
// Safety cap on pagination -- 100 pages * 100/page = 10,000 products. A
// real catalog larger than that would need a genuine incremental/cursor-
// persisted sync design, not an unbounded loop inside one request; this
// cap fails loudly (via the products list simply stopping short, logged
// by the caller) rather than looping forever against a misbehaving
// next_page_token.
const MAX_PRODUCT_SEARCH_PAGES = 100

const ORDER_SEARCH_PAGE_SIZE = 100
// A poll bounded to a rolling lookback window (see importOrders() in
// channel-sync.service.ts) should never need many pages -- same safety-cap
// reasoning as product search, not expected to ever bind in practice.
const MAX_ORDER_SEARCH_PAGES = 50

export class TikTokShopAdapter extends BaseChannelAdapter implements ChannelAdapter {
  channelType: ChannelType = 'TIKTOK_SHOP'
  protected envPrefix = 'TIKTOK_SHOP'
  protected staticCapabilities: StaticChannelCapabilities = {
    requiresAppReview: true,
    supportsProductRead: true,
    // No write capability exists anywhere in this adapter this phase --
    // see this file's header comment.
    supportsProductWrite: false,
    supportsInventoryRead: true,
    supportsInventoryWrite: false,
    supportsOrderImport: true,
    supportsFulfillmentWrite: false,
    // Real Finance/Affiliate APIs are confirmed to exist (per this phase's
    // own research), but the sync code that would populate
    // channel_financial_transactions ships later in this same phase, only
    // once real API access is verified to supply genuine figures.
    supportsFinanceSync: true,
    supportsAffiliateSync: true,
    rateLimitNotes: 'Reportedly ~1,000 queries/hour on a sandbox app (third-party-sourced, unverified -- re-check Partner Center for the real production limit).',
    tokenExpiryNotes: 'Reportedly access_token ~24h (86,400s), refresh_token ~365d (third-party-sourced, unverified -- re-verify before production).',
    notes: 'TikTok Shop Partner Center commerce API (auth.tiktok-shops.com / open-api.tiktokglobalshop.com) -- unrelated to this codebase\'s separate "TikTok for Developers" Content Posting API used for organic publishing.',
  }

  /**
   * Authorize URL param names/path are the most commonly documented shape
   * for a self-built (single-seller) TikTok Shop app -- UNVERIFIED against
   * a primary source. `state` here is TechTools' own CSRF/actor-binding
   * state (see channel-oauth-state.helpers.ts), not a TikTok-specific
   * concept.
   */
  buildAuthorizeUrl(redirectUri: string, state: string): string {
    this.assertAvailable()
    const appKey = this.requireAppKey()
    const url = new URL(`${TIKTOK_SHOP_AUTH_BASE_URL}/oauth/authorize`)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', redirectUri)
    return url.toString()
  }

  /**
   * Token endpoints (auth.tiktok-shops.com) are called with app_key/
   * app_secret directly as query params -- NOT the HMAC `sign` scheme,
   * which applies only to the resource API gateway
   * (open-api.tiktokglobalshop.com), per every source consulted. Endpoint
   * path and the `auth_code`/`grant_type` param names are UNVERIFIED
   * against a primary source.
   */
  async exchangeCodeForToken(input: ChannelOAuthExchangeInput): Promise<ConnectedChannelAccountInfo> {
    this.assertAvailable()
    const appKey = this.requireAppKey()
    const appSecret = this.requireAppSecret()

    const url = new URL(`${TIKTOK_SHOP_AUTH_BASE_URL}/api/v2/token/get`)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('app_secret', appSecret)
    url.searchParams.set('auth_code', input.code)
    url.searchParams.set('grant_type', 'authorized_code')

    const res = await this.fetchOrThrow(url.toString(), { method: 'GET' }, 'TikTok Shop token exchange')
    const body = (await res.json()) as TikTokShopTokenResponse
    if (!body.data) {
      throw new Error(`TikTok Shop token exchange succeeded at the transport level but returned no data (code=${body.code}, message=${body.message}).`)
    }

    const shop = await this.fetchPrimaryAuthorizedShop(body.data.access_token)

    const now = Date.now()
    return {
      externalShopId: shop.id,
      shopCipher: shop.cipher,
      displayName: shop.name,
      marketCountry: shop.region,
      // TikTok Shop does not report a shop-level currency on this
      // endpoint in any source consulted -- left for the connecting staff
      // member to confirm/set explicitly at connect time rather than
      // guessed from region (a country can have more than one plausible
      // currency assumption; never invented here).
      marketCurrency: '',
      accessToken: body.data.access_token,
      refreshToken: body.data.refresh_token,
      accessTokenExpiresAt: new Date(now + body.data.access_token_expire_in * 1000),
      refreshTokenExpiresAt: new Date(now + body.data.refresh_token_expire_in * 1000),
      scopes: [],
    }
  }

  /** Same unsigned-token-endpoint pattern as exchangeCodeForToken. */
  async refreshAccessToken(refreshToken: string): Promise<Pick<ConnectedChannelAccountInfo, 'accessToken' | 'refreshToken' | 'accessTokenExpiresAt' | 'refreshTokenExpiresAt'>> {
    this.assertAvailable()
    const appKey = this.requireAppKey()
    const appSecret = this.requireAppSecret()

    const url = new URL(`${TIKTOK_SHOP_AUTH_BASE_URL}/api/v2/token/refresh`)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('app_secret', appSecret)
    url.searchParams.set('refresh_token', refreshToken)
    url.searchParams.set('grant_type', 'refresh_token')

    const res = await this.fetchOrThrow(url.toString(), { method: 'GET' }, 'TikTok Shop token refresh')
    const body = (await res.json()) as TikTokShopTokenResponse
    if (!body.data) {
      throw new Error(`TikTok Shop token refresh succeeded at the transport level but returned no data (code=${body.code}, message=${body.message}).`)
    }

    const now = Date.now()
    return {
      accessToken: body.data.access_token,
      refreshToken: body.data.refresh_token,
      accessTokenExpiresAt: new Date(now + body.data.access_token_expire_in * 1000),
      refreshTokenExpiresAt: new Date(now + body.data.refresh_token_expire_in * 1000),
    }
  }

  /**
   * Resource-gateway calls (open-api.tiktokglobalshop.com) require the
   * HMAC `sign` query param -- signTikTokShopRequest() computes it.
   * Endpoint path (`/authorization/202309/shops`) is a commonly-referenced
   * pattern for "list shops authorized to this access token,"
   * UNVERIFIED against a primary source.
   */
  private async fetchPrimaryAuthorizedShop(accessToken: string): Promise<{ id: string; cipher: string; name: string; region: string }> {
    const appKey = this.requireAppKey()
    const appSecret = this.requireAppSecret()
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const queryParams: Record<string, string> = {
      app_key: appKey,
      timestamp,
      access_token: accessToken,
    }
    const sign = signTikTokShopRequest({ appSecret, queryParams })

    const url = new URL(`${TIKTOK_SHOP_API_BASE_URL}/authorization/202309/shops`)
    Object.entries(queryParams).forEach(([key, value]) => url.searchParams.set(key, value))
    url.searchParams.set('sign', sign)

    const res = await this.fetchOrThrow(
      url.toString(),
      { method: 'GET', headers: { 'x-tts-access-token': accessToken } },
      'TikTok Shop authorized-shops lookup',
    )
    const body = (await res.json()) as TikTokShopAuthorizedShopsResponse
    const shop = body.data?.shops?.[0]
    if (!shop) {
      throw new Error(`TikTok Shop authorized-shops lookup returned no shops (code=${body.code}, message=${body.message}). A connected account must authorize at least one shop.`)
    }
    return shop
  }

  /**
   * Read-only product/SKU listing -- Phase 1 never calls a write endpoint,
   * so there is nothing here to gate behind a dry-run flag. Endpoint path
   * (`/product/202309/products/search`) and request/response shape are a
   * commonly-referenced pattern for TikTok Shop's product search API,
   * UNVERIFIED against a primary source -- re-check before production use.
   * Paginates via next_page_token up to MAX_PRODUCT_SEARCH_PAGES; a real
   * catalog larger than that cap needs a persisted-cursor redesign, not an
   * unbounded loop.
   */
  async fetchProducts(creds: ChannelConnectionCreds): Promise<ChannelProductSku[]> {
    this.assertAvailable()
    const appKey = this.requireAppKey()
    const appSecret = this.requireAppSecret()

    const allProducts: ChannelProductSku[] = []
    let pageToken: string | undefined
    let pagesFetched = 0

    do {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const queryParams: Record<string, string> = {
        app_key: appKey,
        timestamp,
        access_token: creds.accessToken,
        page_size: String(PRODUCT_SEARCH_PAGE_SIZE),
        ...(creds.shopCipher ? { shop_cipher: creds.shopCipher } : {}),
        ...(pageToken ? { page_token: pageToken } : {}),
      }
      const jsonBody = JSON.stringify({ status: 'ALL' })
      const sign = signTikTokShopRequest({ appSecret, queryParams, jsonBody })

      const url = new URL(`${TIKTOK_SHOP_API_BASE_URL}/product/202309/products/search`)
      Object.entries(queryParams).forEach(([key, value]) => url.searchParams.set(key, value))
      url.searchParams.set('sign', sign)

      const res = await this.fetchOrThrowWithRetry(
        url.toString(),
        {
          method: 'POST',
          headers: { 'x-tts-access-token': creds.accessToken, 'content-type': 'application/json' },
          body: jsonBody,
        },
        'TikTok Shop product search',
      )
      const body = (await res.json()) as TikTokShopProductSearchResponse
      const products = body.data?.products ?? []
      allProducts.push(...flattenTikTokShopProducts(products))

      pageToken = body.data?.next_page_token || undefined
      pagesFetched += 1
    } while (pageToken && pagesFetched < MAX_PRODUCT_SEARCH_PAGES)

    return allProducts
  }

  /**
   * Read-only order listing, bounded by `sinceDate` -- a reconciliation
   * poll, never a full historical export. Endpoint path
   * (`/order/202309/orders/search`), the `create_time_ge` filter param, and
   * the response shape are a commonly-referenced pattern for TikTok Shop's
   * order search API, UNVERIFIED against a primary source -- re-check
   * before production use, same caveat as fetchProducts() above.
   *
   * Production Review Round 1 (§23/§24): never throws away pages that DID
   * succeed just because a later page failed after exhausting retries --
   * returns `complete: false` with whatever was fetched so far instead.
   * The caller (channel-sync.service.ts's importOrders()) uses `complete`
   * to decide whether it's safe to advance the order-import checkpoint.
   */
  async fetchOrders(creds: ChannelConnectionCreds, sinceDate: Date): Promise<FetchOrdersResult> {
    this.assertAvailable()
    const appKey = this.requireAppKey()
    const appSecret = this.requireAppSecret()

    const allOrders: FetchOrdersResult['orders'] = []
    let pageToken: string | undefined
    let pagesFetched = 0
    const createTimeGe = Math.floor(sinceDate.getTime() / 1000).toString()

    try {
      do {
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const queryParams: Record<string, string> = {
          app_key: appKey,
          timestamp,
          access_token: creds.accessToken,
          page_size: String(ORDER_SEARCH_PAGE_SIZE),
          ...(creds.shopCipher ? { shop_cipher: creds.shopCipher } : {}),
          ...(pageToken ? { page_token: pageToken } : {}),
        }
        const jsonBody = JSON.stringify({ create_time_ge: Number(createTimeGe) })
        const sign = signTikTokShopRequest({ appSecret, queryParams, jsonBody })

        const url = new URL(`${TIKTOK_SHOP_API_BASE_URL}/order/202309/orders/search`)
        Object.entries(queryParams).forEach(([key, value]) => url.searchParams.set(key, value))
        url.searchParams.set('sign', sign)

        const res = await this.fetchOrThrowWithRetry(
          url.toString(),
          {
            method: 'POST',
            headers: { 'x-tts-access-token': creds.accessToken, 'content-type': 'application/json' },
            body: jsonBody,
          },
          'TikTok Shop order search',
        )
        const body = (await res.json()) as TikTokShopOrderSearchResponse
        const orders = body.data?.orders ?? []
        allOrders.push(...orders.map(flattenTikTokShopOrder))

        pageToken = body.data?.next_page_token || undefined
        pagesFetched += 1
      } while (pageToken && pagesFetched < MAX_ORDER_SEARCH_PAGES)

      return { orders: allOrders, complete: true }
    } catch (error) {
      return { orders: allOrders, complete: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
