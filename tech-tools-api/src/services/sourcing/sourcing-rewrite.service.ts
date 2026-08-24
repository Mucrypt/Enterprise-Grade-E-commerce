/**
 * AI rewrite for captured product listings (SOURCING-1) -- rewrites a
 * captured title/description into original wording so it isn't a
 * copyright/duplicate-content risk, while preserving every factual spec
 * exactly. Built on the shared OpenAI client extracted from
 * ai.orchestrator.ts (services/ai/openai-client.ts) rather than a second,
 * duplicated HTTP-calling implementation.
 *
 * Also does two things a plain "rewrite the text" pass wouldn't: (1) it
 * knows which marketplace and supplier the listing was captured from, so
 * it can strip marketplace-specific boilerplate ("Buy Product on
 * Alibaba.com", "Amazon's Choice") that the extension's own extraction
 * sometimes can't fully separate from real content; (2) it suggests a
 * category match against the store's REAL category list (never invented)
 * plus SEO meta title/description -- closing a real gap where committed
 * sourced products previously always had category_id/meta_title/
 * meta_description left NULL.
 *
 * Confidence/failure handling mirrors ai_drafts' existing human-in-the-
 * loop shape: a low-confidence or failed rewrite is a visible warning in
 * the dashboard, never a hard block -- the founder can always review/
 * edit/commit using the raw captured text regardless of AI availability.
 * rewriteSourcedProduct() never throws past its own boundary, so one bad
 * row can never kill a worker tick.
 */
import { query } from '../../database/connection'
import logger from '../../utils/logger'
import { callOpenAI, extractJsonObject, OpenAiMessage } from '../ai/openai-client'
import { getSourcedProductById } from './sourced-product.service'

const MAX_DESCRIPTION_CHARS = 6000
const MAX_CATEGORIES_IN_PROMPT = 200

const SYSTEM_PROMPT = `You are a professional e-commerce copywriter rewriting a product listing that was captured from a supplier or marketplace page (Alibaba or Amazon), so it can be republished as original content on an independent multi-brand tools & accessories retailer's own website. You must NOT copy the source wording verbatim.

RULES:
- Rewrite the title and description in your own original wording. Do not reuse more than a short (4 word or fewer) phrase verbatim from the source text.
- The source text was scraped from a live marketplace page and may contain leftover marketplace chrome that is NOT real product content -- strip it entirely. Examples: "Buy Product on Alibaba.com", "Find Complete Details about... Supplier or Manufacturer on Alibaba.com", "Amazon's Choice", "Add to Cart", "Currently unavailable", star-rating/review-count text, "Click to play video". Never carry these into the rewrite, and never mention the source marketplace or supplier by name in the rewritten copy -- the founder is the seller of record now, not the original marketplace listing.
- Preserve every factual, verifiable spec exactly (dimensions, weight, material, voltage, capacity, quantities, certifications). Never invent, round, or alter a number or unit that was given.
- Do not invent claims not present in the source (no fabricated certifications, awards, "bestseller" status, or performance numbers).
- Do not use marketing superlatives the source didn't support ("revolutionary", "#1") unless the source itself made an equivalent claim.
- "descriptionHtml" should be simple HTML (paragraphs, a bullet list of specs is fine) -- no scripts, no external resources, no inline styles, no <link>/<meta>/<iframe> tags.
- "metaTitle": an SEO-friendly page title, under 60 characters, no marketplace branding.
- "metaDescription": an SEO-friendly meta description, under 155 characters, written to earn a click from a search results page.
- "suggestedCategoryId": pick the SINGLE best-matching id from the CATEGORIES list provided in the user message. You MUST copy an id exactly as given -- never invent one. If genuinely nothing fits, use null.
- "confidence" is 0-100. Set it below 60 if the source text was too sparse or garbled to confidently rewrite, or specs looked internally inconsistent -- never guess to fill a gap.
- Output strict JSON only, matching this exact shape, no markdown fencing, no commentary: {"title": string, "descriptionHtml": string, "metaTitle": string, "metaDescription": string, "suggestedCategoryId": string | null, "confidence": number, "notes": string}`

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface CategoryOption {
  id: string
  name: string
}

async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const result = await query(
    `SELECT id, name FROM categories WHERE is_active = true ORDER BY display_order ASC, name ASC LIMIT $1`,
    [MAX_CATEGORIES_IN_PROMPT],
  )
  return result.rows
}

interface RewriteResult {
  title: string
  descriptionHtml: string
  metaTitle: string | null
  metaDescription: string | null
  suggestedCategoryId: string | null
  confidence: number
  notes: string
}

async function requestRewrite(sourced: any, categories: CategoryOption[]): Promise<RewriteResult> {
  const plainDescription = stripHtml(sourced.captured_description_html).slice(0, MAX_DESCRIPTION_CHARS)
  const lowestTier = Array.isArray(sourced.captured_price_tiers) ? sourced.captured_price_tiers[0] : null

  const userContent = JSON.stringify(
    {
      sourcePlatform: sourced.source_platform,
      supplierName: sourced.captured_supplier_name || null,
      title: sourced.captured_title,
      description: plainDescription,
      specs: sourced.captured_specs || {},
      approxUnitCost: lowestTier ? `${lowestTier.price} ${lowestTier.currency}` : null,
      CATEGORIES: categories.map((c) => ({ id: c.id, name: c.name })),
    },
    null,
    2,
  )

  const messages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const response = await callOpenAI(messages, { jsonMode: true })
  const rawContent = response.choices?.[0]?.message?.content
  if (!rawContent) throw new Error('OpenAI returned no content')

  const jsonText = extractJsonObject(rawContent)
  const parsed = JSON.parse(jsonText)

  if (!parsed.title || !parsed.descriptionHtml) {
    throw new Error('AI rewrite response is missing title/descriptionHtml')
  }

  // Never trust the model's id claim blindly -- only accept it if it's
  // genuinely one of the ids we offered.
  const validCategoryIds = new Set(categories.map((c) => c.id))
  const suggestedCategoryId =
    typeof parsed.suggestedCategoryId === 'string' && validCategoryIds.has(parsed.suggestedCategoryId)
      ? parsed.suggestedCategoryId
      : null

  const confidence = Number(parsed.confidence)
  return {
    title: String(parsed.title).trim(),
    descriptionHtml: String(parsed.descriptionHtml),
    metaTitle: typeof parsed.metaTitle === 'string' ? parsed.metaTitle.trim().slice(0, 255) || null : null,
    metaDescription: typeof parsed.metaDescription === 'string' ? parsed.metaDescription.trim().slice(0, 500) || null : null,
    suggestedCategoryId,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  }
}

/**
 * Called by sourcing-rewrite.worker.ts's poll AND by the dashboard's
 * manual "Regenerate" button (rate-limited at the route level for the
 * latter). Never throws -- always resolves to a status update on the row.
 */
export async function rewriteSourcedProduct(sourcedProductId: string): Promise<void> {
  const sourced = await getSourcedProductById(sourcedProductId)
  if (!sourced) return

  await query(`UPDATE sourced_products SET status = 'rewriting', rewrite_attempt_count = rewrite_attempt_count + 1 WHERE id = $1`, [
    sourcedProductId,
  ])

  try {
    const model = process.env.AI_MODEL || 'gpt-5.5'
    const categories = await loadCategoryOptions()
    const result = await requestRewrite(sourced, categories)

    await query(
      `UPDATE sourced_products
       SET status = 'ready_for_review', rewritten_title = $2, rewritten_description_html = $3,
           rewritten_meta_title = $4, rewritten_meta_description = $5, rewritten_category_id = $6,
           rewrite_model_name = $7, rewrite_confidence = $8, rewrite_notes = $9,
           rewrite_attempted_at = now(), rewrite_error = NULL, updated_at = now()
       WHERE id = $1`,
      [
        sourcedProductId,
        result.title,
        result.descriptionHtml,
        result.metaTitle,
        result.metaDescription,
        result.suggestedCategoryId,
        model,
        result.confidence,
        result.notes,
      ],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[SourcingRewrite] Rewrite failed for sourced product ${sourcedProductId}`, error)
    await query(
      `UPDATE sourced_products SET status = 'rewrite_failed', rewrite_error = $2, rewrite_attempted_at = now(), updated_at = now() WHERE id = $1`,
      [sourcedProductId, message],
    )
  }
}

/** Synchronous manual regenerate -- the founder is actively waiting on the dashboard, unlike the background worker's queued pass. */
export async function regenerateRewrite(sourcedProductId: string): Promise<void> {
  await rewriteSourcedProduct(sourcedProductId)
}
