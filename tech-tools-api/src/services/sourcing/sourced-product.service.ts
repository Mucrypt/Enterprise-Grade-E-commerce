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
  supplierName?: string | null
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
       captured_by_token_id, captured_by_user_id, captured_supplier_name
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18)
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
      payload.supplierName?.trim() || null,
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

export interface SupplierSummary {
  supplierName: string
  sourcePlatform: SourcePlatform
  totalSourced: number
  totalCommitted: number
  avgMarginPercent: number | null
  lastCapturedAt: string
  sampleSourceUrl: string
}

/**
 * Groups by (supplier name, platform) rather than name alone -- the same
 * company name could theoretically appear on both Alibaba and Amazon, and
 * conflating them would misrepresent the relationship. Only rows with a
 * captured supplier name are counted (extraction can't always find one).
 */
export async function listSuppliers(): Promise<SupplierSummary[]> {
  const result = await query(`
    SELECT
      captured_supplier_name AS supplier_name,
      source_platform,
      count(*) AS total_sourced,
      count(*) FILTER (WHERE status = 'committed') AS total_committed,
      avg(
        CASE WHEN status = 'committed' AND final_sale_price > 0
          THEN ((final_sale_price - COALESCE(final_cost_price, captured_cost_price_eur, 0)) / final_sale_price) * 100
        END
      ) AS avg_margin_percent,
      max(captured_at) AS last_captured_at,
      (array_agg(source_url ORDER BY captured_at DESC))[1] AS sample_source_url
    FROM sourced_products
    WHERE captured_supplier_name IS NOT NULL AND captured_supplier_name != ''
    GROUP BY captured_supplier_name, source_platform
    ORDER BY total_sourced DESC
  `)
  return result.rows.map((row) => ({
    supplierName: row.supplier_name,
    sourcePlatform: row.source_platform,
    totalSourced: Number(row.total_sourced),
    totalCommitted: Number(row.total_committed),
    avgMarginPercent: row.avg_margin_percent !== null ? Math.round(Number(row.avg_margin_percent) * 10) / 10 : null,
    lastCapturedAt: row.last_captured_at,
    sampleSourceUrl: row.sample_source_url,
  }))
}

export interface SourcingAnalytics {
  totals: {
    total: number
    committed: number
    discarded: number
    pendingReview: number
    rewriteFailed: number
    conversionRate: number | null
  }
  avgMarginPercent: number | null
  byPlatform: Array<{ platform: SourcePlatform; total: number; committed: number }>
  captureTrend: Array<{ day: string; count: number }>
  recentCommitted: Array<{
    id: string
    title: string
    sourcePlatform: SourcePlatform
    committedProductId: string | null
    committedAt: string | null
    finalSalePrice: string | null
    marginPercent: number | null
  }>
}

/**
 * Aggregates purely from sourced_products -- everything the pipeline
 * needs is already there (final_cost_price/final_sale_price at commit
 * time), so this never has to join products/orders.
 */
export async function getSourcingAnalytics(): Promise<SourcingAnalytics> {
  const totalsResult = await query(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE status = 'committed') AS committed,
      count(*) FILTER (WHERE status = 'discarded') AS discarded,
      count(*) FILTER (WHERE status IN ('ready_for_review', 'review_edited')) AS pending_review,
      count(*) FILTER (WHERE status = 'rewrite_failed') AS rewrite_failed,
      avg(
        CASE WHEN status = 'committed' AND final_sale_price > 0
          THEN ((final_sale_price - COALESCE(final_cost_price, captured_cost_price_eur, 0)) / final_sale_price) * 100
        END
      ) AS avg_margin_percent
    FROM sourced_products
  `)
  const t = totalsResult.rows[0]
  const total = Number(t.total)
  const committed = Number(t.committed)

  const byPlatformResult = await query(`
    SELECT source_platform AS platform, count(*) AS total, count(*) FILTER (WHERE status = 'committed') AS committed
    FROM sourced_products
    GROUP BY source_platform
    ORDER BY source_platform
  `)

  const trendResult = await query(`
    SELECT to_char(date_trunc('day', captured_at), 'YYYY-MM-DD') AS day, count(*) AS count
    FROM sourced_products
    WHERE captured_at > now() - interval '30 days'
    GROUP BY 1
    ORDER BY 1
  `)

  const recentResult = await query(`
    SELECT id, COALESCE(review_title, rewritten_title, captured_title) AS title, source_platform,
           committed_product_id, committed_at, final_sale_price,
           CASE WHEN final_sale_price > 0
             THEN ((final_sale_price - COALESCE(final_cost_price, captured_cost_price_eur, 0)) / final_sale_price) * 100
           END AS margin_percent
    FROM sourced_products
    WHERE status = 'committed'
    ORDER BY committed_at DESC
    LIMIT 10
  `)

  return {
    totals: {
      total,
      committed,
      discarded: Number(t.discarded),
      pendingReview: Number(t.pending_review),
      rewriteFailed: Number(t.rewrite_failed),
      conversionRate: total > 0 ? Math.round((committed / total) * 1000) / 10 : null,
    },
    avgMarginPercent: t.avg_margin_percent !== null ? Math.round(Number(t.avg_margin_percent) * 10) / 10 : null,
    byPlatform: byPlatformResult.rows.map((row) => ({
      platform: row.platform,
      total: Number(row.total),
      committed: Number(row.committed),
    })),
    captureTrend: trendResult.rows.map((row) => ({ day: row.day, count: Number(row.count) })),
    recentCommitted: recentResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      sourcePlatform: row.source_platform,
      committedProductId: row.committed_product_id,
      committedAt: row.committed_at,
      finalSalePrice: row.final_sale_price,
      marginPercent: row.margin_percent !== null ? Math.round(Number(row.margin_percent) * 10) / 10 : null,
    })),
  }
}

/**
 * Every capture INSERTs a new row (see captureProduct's header comment) --
 * there's no dedup by source_url. This surfaces the other drafts for the
 * same product page so re-importing the same URL doesn't quietly leave a
 * pile of stale, easy-to-confuse duplicates (the founder hit exactly this
 * during live testing: kept looking at an old draft after re-capturing).
 */
/**
 * Backs the "Recheck price" link on a committed product's edit page --
 * founder-initiated only (opens the original listing so they can compare
 * and manually re-import if something changed). Never a background job:
 * that would mean the server fetching Alibaba/Amazon on its own, which is
 * the one thing this whole feature was built to avoid.
 */
export async function getSourcedProductByCommittedProductId(
  productId: string,
): Promise<{ id: string; sourceUrl: string; sourcePlatform: SourcePlatform; capturedSupplierName: string | null } | null> {
  const result = await query(
    `SELECT id, source_url, source_platform, captured_supplier_name
     FROM sourced_products WHERE committed_product_id = $1 AND status = 'committed'
     LIMIT 1`,
    [productId],
  )
  if (!result.rows[0]) return null
  return {
    id: result.rows[0].id,
    sourceUrl: result.rows[0].source_url,
    sourcePlatform: result.rows[0].source_platform,
    capturedSupplierName: result.rows[0].captured_supplier_name,
  }
}

export async function listSiblingDrafts(sourceUrl: string, excludeId: string): Promise<any[]> {
  const result = await query(
    `SELECT id, status, captured_at FROM sourced_products WHERE source_url = $1 AND id != $2 ORDER BY captured_at DESC`,
    [sourceUrl, excludeId],
  )
  return result.rows
}

export interface ReviewFieldsUpdate {
  reviewTitle?: string
  reviewDescriptionHtml?: string
  reviewImages?: CapturedImage[]
  reviewSpecs?: Record<string, string>
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
         review_specs = COALESCE($5::jsonb, review_specs),
         final_cost_price = COALESCE($6, final_cost_price),
         final_sale_price = COALESCE($7, final_sale_price),
         status = 'review_edited',
         reviewed_by = $8,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [
      id,
      fields.reviewTitle ?? null,
      fields.reviewDescriptionHtml ?? null,
      fields.reviewImages ? JSON.stringify(fields.reviewImages) : null,
      fields.reviewSpecs ? JSON.stringify(fields.reviewSpecs) : null,
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
 * New products commit as ACTIVE (is_active = true), matching the normal
 * "create product" flow's own default -- a committed sourced product
 * shows up on the storefront/mobile app immediately, same as one entered
 * by hand. (An earlier version of this function defaulted to inactive as
 * an extra safety step, but that meant a "published" product silently
 * never appeared anywhere the founder could see it, which read as a bug
 * rather than a safety feature -- reverted after live testing surfaced
 * exactly that confusion.) Deactivate it from the normal product edit
 * page if a specific listing needs to stay hidden.
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
      [sku, title.trim(), slug, descriptionHtml, salePrice, salePrice, costPrice, 0, true, true],
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

    const specs: Record<string, string> = sourced.review_specs || sourced.captured_specs || {}
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
