/**
 * AI rewrite for captured product listings (SOURCING-1) -- rewrites a
 * captured title/description into original wording so it isn't a
 * copyright/duplicate-content risk, while preserving every factual spec
 * exactly. Built on the shared OpenAI client extracted from
 * ai.orchestrator.ts (services/ai/openai-client.ts) rather than a second,
 * duplicated HTTP-calling implementation.
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

const SYSTEM_PROMPT = `You are rewriting a dropshipping product listing captured from a supplier or marketplace page so it can be republished as original content on an independent store's own website. You must NOT copy the source wording verbatim.

RULES:
- Rewrite the title and description in your own original wording. Do not reuse more than a short (4 word or fewer) phrase verbatim from the source text.
- Preserve every factual, verifiable spec exactly (dimensions, weight, material, voltage, capacity, quantities, certifications). Never invent, round, or alter a number or unit that was given.
- Do not invent claims not present in the source (no fabricated certifications, awards, "bestseller" status, or performance numbers).
- Do not use marketing superlatives the source didn't support ("revolutionary", "#1") unless the source itself made an equivalent claim.
- Output strict JSON only, no markdown fencing, no commentary: {"title": string, "descriptionHtml": string, "confidence": number, "notes": string}
- "confidence" is 0-100. Set it below 60 if the source text was too sparse or garbled to confidently rewrite, or specs looked internally inconsistent -- never guess to fill a gap.
- "descriptionHtml" should be simple HTML (paragraphs, a bullet list of specs is fine) -- no scripts, no external resources, no inline styles.`

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface RewriteResult {
  title: string
  descriptionHtml: string
  confidence: number
  notes: string
}

async function requestRewrite(sourced: any): Promise<RewriteResult> {
  const plainDescription = stripHtml(sourced.captured_description_html).slice(0, MAX_DESCRIPTION_CHARS)
  const userContent = JSON.stringify(
    {
      title: sourced.captured_title,
      description: plainDescription,
      specs: sourced.captured_specs || {},
    },
    null,
    2,
  )

  const messages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]

  const response = await callOpenAI(messages)
  const rawContent = response.choices?.[0]?.message?.content
  if (!rawContent) throw new Error('OpenAI returned no content')

  const jsonText = extractJsonObject(rawContent)
  const parsed = JSON.parse(jsonText)

  if (!parsed.title || !parsed.descriptionHtml) {
    throw new Error('AI rewrite response is missing title/descriptionHtml')
  }

  const confidence = Number(parsed.confidence)
  return {
    title: String(parsed.title).trim(),
    descriptionHtml: String(parsed.descriptionHtml),
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
    const result = await requestRewrite(sourced)

    await query(
      `UPDATE sourced_products
       SET status = 'ready_for_review', rewritten_title = $2, rewritten_description_html = $3,
           rewrite_model_name = $4, rewrite_confidence = $5, rewrite_notes = $6,
           rewrite_attempted_at = now(), rewrite_error = NULL, updated_at = now()
       WHERE id = $1`,
      [sourcedProductId, result.title, result.descriptionHtml, model, result.confidence, result.notes],
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
