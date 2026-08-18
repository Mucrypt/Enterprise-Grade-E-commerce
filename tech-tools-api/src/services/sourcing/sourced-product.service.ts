/**
 * Core CRUD/state-machine for the sourcing staging table (SOURCING-1).
 * captureProduct() is the only entry point the browser extension ever
 * calls (via POST /api/v1/sourcing/captures) -- kept fast and synchronous
 * (no AI call inline) so the extension's button click never waits on
 * OpenAI. commitSourcedProduct() is the one function in this whole
 * domain that ever writes to the live `products` table -- everything
 * else is staging, always reviewable, always discardable.
 */
import { randomUUID } from 'crypto'
import { query, getClient } from '../../database/connection'
import logger from '../../utils/logger'
import { convertToEur } from './sourcing-fx.service'
import { applyPricingSuggestion } from './sourcing-pricing.service'

export type SourcePlatform = 'alibaba' | 'amazon'

export interface CapturedImage {
  url: string
  altText?: string | null
  position?: number
}

export interface CapturedPriceTier {
  minQty: number
  maxQty?: number | null
  price: number
  currency: string
}

export interface CapturePayload {
  sourcePlatform: SourcePlatform
  sourceUrl: string
  sourceProductId?: string | null
  title: string
  descriptionHtml?: string | null
  images: CapturedImage[]
  priceTiers: CapturedPriceTier[]
  variantOptions?: unknown[]
  specs?: Record<string, string>
  currency: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Fast path: validate, convert currency, insert, apply a pricing
 * suggestion, return. The AI rewrite is deliberately NOT triggered here
 * -- sourcing-rewrite.worker.ts picks up 'captured' rows on its own
 * schedule, so a slow or unavailable OpenAI call can never block the
 * extension's response.
 */
export async function captureProduct(
  payload: CapturePayload,
  capturedByUserId: string,
  capturedByTokenId: string | null,
): Promise<{ id: string }> {
  if (!payload.title?.trim()) throw new Error('Captured product has no title')
  if (!payload.sourceUrl?.trim()) throw new Error('Captured product has no source URL')
  if (!['alibaba', 'amazon'].includes(payload.sourcePlatform)) throw new Error('Unrecognized source platform')

  // The lowest-quantity tier is the most representative single-unit cost
  // -- Alibaba's own MOQ tiers only get cheaper at higher quantities, so
  // tier[0] (assumed sorted ascending by minQty, as the extension sends
  // it) is the founder's real per-unit cost for a first, small order.
  const lowestTier = [...(payload.priceTiers || [])].sort((a, b) => a.minQty - b.minQty)[0] ?? null
  const originalCostPrice = lowestTier?.price ?? null
  const originalCurrency = (lowestTier?.currency || payload.currency || 'USD').toUpperCase()

  let costPriceEur: number | null = null
  let fxRateUsed: number | null = null
  let fxRateSource: string | null = null
  if (originalCostPrice !== null) {
    const conversion = await convertToEur(originalCostPrice, originalCurrency)
    if (conversion) {
      costPriceEur = conversion.amountEur
      fxRateUsed = conversion.rate
      fxRateSource = conversion.source
    }
  }

  const result = await query(
    `INSERT INTO sourced_products (
       status, source_platform, source_url, source_product_id,
       captured_title, captured_description_html, captured_images, captured_price_tiers,
       captured_variant_options, captured_specs, captured_currency,
       captured_cost_price_original, captured_cost_price_eur, fx_rate_used, fx_rate_source,
       captured_by_token_id, captured_by_user_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id`,
    [
      'captured',
      payload.sourcePlatform,
      payload.sourceUrl,
      payload.sourceProductId ?? null,
      payload.title.trim(),
      payload.descriptionHtml ?? null,
      JSON.stringify(payload.images || []),
      JSON.stringify(payload.priceTiers || []),
      JSON.stringify(payload.variantOptions || []),
      JSON.stringify(payload.specs || {}),
      originalCurrency,
      originalCostPrice,
      costPriceEur,
      fxRateUsed,
      fxRateSource,
      capturedByTokenId,
      capturedByUserId,
    ],
  )

  const sourcedProductId = result.rows[0].id

  if (costPriceEur !== null) {
    try {
      await applyPricingSuggestion(sourcedProductId)
    } catch (error) {
      // A pricing failure must never fail the capture itself -- the
      // founder can still set final_cost_price/final_sale_price manually
      // in the review UI.
      logger.error(`[Sourcing] Pricing suggestion failed for ${sourcedProductId}`, error)
    }
  }

  return { id: sourcedProductId }
}

export async function listSourcedProducts(filters: { status?: string }, limit = 100): Promise<any[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  if (filters.status) {
    conditions.push(`status = $${values.length + 1}`)
    values.push(filters.status)
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  values.push(limit)

  const result = await query(
    `SELECT id, status, source_platform, source_url, captured_title, rewritten_title, review_title,
            captured_images, rewrite_confidence, suggested_sale_price, suggested_margin_percent,
            final_sale_price, captured_cost_price_eur, captured_at, committed_product_id
     FROM sourced_products
     ${whereClause}
     ORDER BY captured_at DESC
     LIMIT $${values.length}`,
    values,
  )
  return result.rows
}

export async function getSourcedProductById(id: string): Promise<any | null> {
  const result = await query(`SELECT * FROM sourced_products WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export interface ReviewFieldsUpdate {
  reviewTitle?: string
  reviewDescriptionHtml?: string
  reviewImages?: CapturedImage[]
  finalCostPrice?: number
  finalSalePrice?: number
}

export async function updateReviewFields(id: string, fields: ReviewFieldsUpdate, reviewedByUserId: string): Promise<void> {
  const existing = await getSourcedProductById(id)
  if (!existing) throw new Error('Sourced product not found')
  if (existing.status === 'committed' || existing.status === 'discarded') {
    throw new Error(`Cannot edit a sourced product that is already "${existing.status}"`)
  }

  await query(
    `UPDATE sourced_products
     SET review_title = COALESCE($2, review_title),
         review_description_html = COALESCE($3, review_description_html),
         review_images = COALESCE($4::jsonb, review_images),
         final_cost_price = COALESCE($5, final_cost_price),
         final_sale_price = COALESCE($6, final_sale_price),
         status = 'review_edited',
         reviewed_by = $7,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [
      id,
      fields.reviewTitle ?? null,
      fields.reviewDescriptionHtml ?? null,
      fields.reviewImages ? JSON.stringify(fields.reviewImages) : null,
      fields.finalCostPrice ?? null,
      fields.finalSalePrice ?? null,
      reviewedByUserId,
    ],
  )
}

export async function discardSourcedProduct(id: string, reason: string | null, _userId: string): Promise<void> {
  const existing = await getSourcedProductById(id)
  if (!existing) throw new Error('Sourced product not found')
  if (existing.status === 'committed') throw new Error('Cannot discard a sourced product that has already been committed')

  await query(`UPDATE sourced_products SET status = 'discarded', discard_reason = $2, updated_at = now() WHERE id = $1`, [id, reason])
}

/**
 * The one function in this domain that ever writes to `products`. Never
 * touches product_variations (confirmed stub-only elsewhere in this
 * codebase) -- always creates a single-SKU product. Starting stock is
 * always 0 with backorders allowed: a dropshipped item has no real
 * on-hand stock until the founder decides to stock some at home, exactly
 * as they described -- adjustable afterward through the normal product
 * edit page like any other product.
 *
 * New products commit as INACTIVE (is_active = false) -- a freshly
 * reviewed sourced listing should not go live on the storefront the
 * instant it's committed; the founder flips it active from the normal
 * product edit page once satisfied. This is a deliberate safety default,
 * not something the founder explicitly specified -- easy to change if
 * they'd rather it publish live immediately.
 */
export async function commitSourcedProduct(id: string, userId: string): Promise<{ productId: string }> {
  const sourced = await getSourcedProductById(id)
  if (!sourced) throw new Error('Sourced product not found')
  if (sourced.status === 'committed') throw new Error('This sourced product has already been committed')
  if (sourced.status === 'discarded') throw new Error('Cannot commit a discarded sourced product')

  const title: string = sourced.review_title || sourced.rewritten_title || sourced.captured_title
  const descriptionHtml: string | null = sourced.review_description_html || sourced.rewritten_description_html || sourced.captured_description_html
  const images: CapturedImage[] = sourced.review_images || sourced.captured_images || []
  const costPrice: number | null = sourced.final_cost_price ?? sourced.captured_cost_price_eur
  const salePrice: number | null = sourced.final_sale_price ?? sourced.suggested_sale_price

  if (!title?.trim()) throw new Error('Cannot commit: no title available')
  if (!images.length) throw new Error('Cannot commit: at least one image is required')
  if (costPrice === null || costPrice === undefined) throw new Error('Cannot commit: no cost price set -- enter one on the Pricing tab')
  if (salePrice === null || salePrice === undefined) throw new Error('Cannot commit: no sale price set -- enter one on the Pricing tab')

  const slugBase = slugify(title) || 'product'
  const suffix = randomUUID().slice(0, 8)
  const slug = `${slugBase}-${suffix}`
  const sku = `SRC-${suffix.toUpperCase()}`

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const productResult = await client.query(
      `INSERT INTO products (
         sku, name, slug, description, base_price, sale_price, cost_price,
         stock_quantity, is_active, is_backorder_allowed
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [sku, title.trim(), slug, descriptionHtml, salePrice, salePrice, costPrice, 0, false, true],
    )
    const productId = productResult.rows[0].id

    await client.query(`INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES ($1, 0, 0)`, [productId])

    for (const [index, image] of images.entries()) {
      if (!image?.url) continue
      await client.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order) VALUES ($1, $2, $3, $4, $5)`,
        [productId, image.url, image.altText ?? null, index === 0, image.position ?? index],
      )
    }

    const specs: Record<string, string> = sourced.captured_specs || {}
    for (const [key, value] of Object.entries(specs)) {
      if (!key || value === undefined || value === null) continue
      await client.query(
        `INSERT INTO product_specifications (product_id, spec_key, spec_value) VALUES ($1, $2, $3)`,
        [productId, key.slice(0, 100), String(value)],
      )
    }

    const grossMargin = salePrice - costPrice
    const marginPercent = salePrice > 0 ? Math.round((grossMargin / salePrice) * 10000) / 100 : 0
    await client.query(
      `INSERT INTO product_unit_economics (product_id, sell_price, landed_cost, gross_margin, contribution_margin, margin_percent)
       VALUES ($1, $2, $3, $4, $4, $5)
       ON CONFLICT (product_id) DO UPDATE SET
         sell_price = EXCLUDED.sell_price, landed_cost = EXCLUDED.landed_cost,
         gross_margin = EXCLUDED.gross_margin, contribution_margin = EXCLUDED.contribution_margin,
         margin_percent = EXCLUDED.margin_percent, updated_at = now()`,
      [productId, salePrice, costPrice, grossMargin, marginPercent],
    )

    await client.query(
      `UPDATE sourced_products SET status = 'committed', committed_product_id = $2, committed_at = now(), committed_by = $3, updated_at = now() WHERE id = $1`,
      [id, productId, userId],
    )

    await client.query('COMMIT')
    return { productId }
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error(`[Sourcing] Commit failed for sourced product ${id}`, error)
    throw error
  } finally {
    client.release()
  }
}
