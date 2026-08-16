/**
 * Raw TikTok Shop Partner Center API response shapes -- only the fields
 * this codebase actually reads. Base URLs and token-exchange shape
 * sourced from official-domain search results plus corroborating
 * third-party integration guides (Partner Center's own docs are a
 * JS-rendered SPA unreadable by automated fetch tools) -- re-verify
 * against real Partner Center documentation and a real sandbox app before
 * any of this is relied on in production. See
 * docs/TIKTOK-SHOP-COMMERCE-ARCHITECTURE.md.
 */
import { ChannelOrder, ChannelProductSku } from '../channel-account.types'

// Non-US ("Global Partner Portal") base URLs -- this deployment's shop is
// Italy, a non-US market. If a US-registered shop is ever connected, these
// would need a separate US Partner Portal base URL, not assumed here.
export const TIKTOK_SHOP_AUTH_BASE_URL = 'https://auth.tiktok-shops.com'
export const TIKTOK_SHOP_API_BASE_URL = 'https://open-api.tiktokglobalshop.com'

export interface TikTokShopTokenResponse {
  code: number
  message: string
  data?: {
    access_token: string
    access_token_expire_in: number
    refresh_token: string
    refresh_token_expire_in: number
    open_id?: string
    seller_name?: string
    seller_base_region?: string
    user_type?: number
  }
}

export interface TikTokShopAuthorizedShop {
  id: string
  name: string
  region: string
  seller_type?: string
  cipher: string
  code?: string
}

export interface TikTokShopAuthorizedShopsResponse {
  code: number
  message: string
  data?: {
    shops: TikTokShopAuthorizedShop[]
  }
}

export interface TikTokShopProductSku {
  id: string
  seller_sku: string
  price?: { sale_price?: string; currency?: string }
  inventory?: { warehouse_id?: string; quantity?: number }[]
}

export interface TikTokShopProduct {
  id: string
  title: string
  status: string
  skus: TikTokShopProductSku[]
}

export interface TikTokShopProductSearchResponse {
  code: number
  message: string
  data?: {
    products: TikTokShopProduct[]
    next_page_token?: string
    total_count?: number
  }
}

export function flattenTikTokShopProducts(products: TikTokShopProduct[]): ChannelProductSku[] {
  const flat: ChannelProductSku[] = []
  for (const product of products) {
    for (const sku of product.skus || []) {
      const totalStock = (sku.inventory || []).reduce((sum, entry) => sum + (entry.quantity ?? 0), 0)
      flat.push({
        channelProductId: product.id,
        productTitle: product.title,
        productStatus: product.status,
        channelSkuId: sku.id,
        sellerSku: sku.seller_sku,
        price: sku.price?.sale_price ? Number(sku.price.sale_price) : null,
        currency: sku.price?.currency ?? null,
        stock: (sku.inventory || []).length > 0 ? totalStock : null,
      })
    }
  }
  return flat
}

export interface TikTokShopOrderLineItem {
  id: string
  product_id: string
  product_name: string
  seller_sku: string
  sale_price?: string
  quantity?: number
}

export interface TikTokShopOrderPayment {
  currency: string
  total_amount: string
  shipping_fee?: string
  tax?: string
}

export interface TikTokShopOrderRecipientAddress {
  name?: string
  region_code?: string
}

export interface TikTokShopOrder {
  id: string
  status: string
  create_time: number
  /**
   * The order's own last-modified unix timestamp, reportedly present on
   * TikTok Shop order objects alongside create_time (consistent with the
   * create_time/update_time pairing convention seen elsewhere in this
   * API) -- UNVERIFIED against a primary source, same caveat as every
   * other field in this file. If TikTok omits it for a given order,
   * flattenTikTokShopOrder() below leaves ChannelOrder.externalUpdatedAt
   * null rather than guessing a value, and importOrders() applies every
   * update unconditionally in that case (no ordering signal available).
   */
  update_time?: number
  recipient_address?: TikTokShopOrderRecipientAddress
  payment?: TikTokShopOrderPayment
  line_items: TikTokShopOrderLineItem[]
}

export interface TikTokShopOrderSearchResponse {
  code: number
  message: string
  data?: {
    orders: TikTokShopOrder[]
    next_page_token?: string
    total_count?: number
  }
}

/**
 * `payment.total_amount` missing/unparseable produces `NaN`, and a missing
 * `payment.currency` produces an empty string -- both deliberate sentinels,
 * left as-is rather than silently defaulting to 0/a guessed currency code.
 * The importer (channel-sync.service.ts's importOrders()) checks for a
 * finite grossAmount and a non-empty currency and routes any order that
 * fails either check into channel_order_import_issues (reason
 * INVALID_ORDER_AMOUNT / MISSING_CURRENCY) instead of inserting a
 * misleading row -- see Production Review Round 1 §5/§9.
 */
export function flattenTikTokShopOrder(order: TikTokShopOrder): ChannelOrder {
  const payment = order.payment
  return {
    channelOrderId: order.id,
    channelOrderStatus: order.status,
    buyerDisplayName: order.recipient_address?.name ?? null,
    buyerCountry: order.recipient_address?.region_code ?? null,
    currency: payment?.currency ?? '',
    grossAmount: payment?.total_amount ? Number(payment.total_amount) : NaN,
    shippingFeeAmount: payment?.shipping_fee ? Number(payment.shipping_fee) : null,
    taxAmount: payment?.tax ? Number(payment.tax) : null,
    externalUpdatedAt: typeof order.update_time === 'number' ? new Date(order.update_time * 1000) : null,
    items: (order.line_items || []).map((item) => ({
      channelSku: item.seller_sku,
      channelProductId: item.product_id,
      productTitle: item.product_name,
      quantity: item.quantity ?? 1,
      unitPrice: item.sale_price ? Number(item.sale_price) : null,
      lineTotal: item.sale_price && item.quantity ? Number(item.sale_price) * item.quantity : null,
    })),
    rawPayload: order as unknown as Record<string, unknown>,
  }
}
