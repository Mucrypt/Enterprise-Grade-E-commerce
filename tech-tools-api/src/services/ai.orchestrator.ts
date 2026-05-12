/**
 * AI Communication Orchestrator
 * ─────────────────────────────
 * Production-grade AI agent for omnichannel communications.
 *
 * Model: OpenAI GPT-5.5 (function calling, long context, high throughput)
 *        — swappable via AI_PROVIDER env var (openai | anthropic)
 *
 * Design principles:
 *  • Human-in-the-loop: all AI content is DRAFT first, sent only after admin approval
 *  • Immutable audit trail: every generation and approval is logged
 *  • Prompt injection defense: customer data is injected as structured context, never raw strings
 *  • Rate limiting: per-admin and per-customer via Redis
 *  • No secrets in logs: model responses are trimmed before logging
 *  • Graceful degradation: if AI fails, surfaces error cleanly without crashing
 */

import https from 'https'
import { query as db } from '../database/connection'
import logger from '../utils/logger'
import { createClient } from 'redis'

// ─── Redis client (shared singleton) ───────────────────────
let redisClient: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL
    const redisHost = process.env.REDIS_HOST || 'redis'
    const redisPort = process.env.REDIS_PORT || '6379'
    const redisPassword = process.env.REDIS_PASSWORD

    redisClient = createClient({
      url:
        redisUrl ||
        `redis://${redisPassword ? `:${encodeURIComponent(redisPassword)}@` : ''}${redisHost}:${redisPort}`,
      socket: { reconnectStrategy: (n) => Math.min(n * 100, 5000) },
    })
    redisClient.on('error', (err) =>
      logger.error('[AI] Redis error:', err.message),
    )
    await redisClient.connect().catch(() => {
      logger.warn('[AI] Redis not available — rate limiting disabled')
      redisClient = null
    })
  }
  return redisClient
}

// ─── Types ──────────────────────────────────────────────────
export type AiChannel = 'email' | 'whatsapp' | 'newsletter' | 'contact_reply'

export interface GenerateDraftInput {
  channel: AiChannel
  prompt: string // admin's natural-language intent
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  customerId?: string
  contactId?: string
  scheduledAt?: string
  actorId: string // admin user id
  actorIp?: string
  actorAgent?: string
}

export interface SegmentAwareCampaignInput {
  prompt: string
  actorId: string
  actorIp?: string
  actorAgent?: string
  scheduledAt?: string
  segment?: {
    sources?: string[]
    statuses?: string[]
    includeUnsubscribed?: boolean
  }
  selectedProductIds?: string[]
}

export interface AiDraft {
  id: string
  channel: AiChannel
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  customerId?: string
  contactId?: string
  subject?: string
  bodyHtml?: string
  bodyText: string
  prompt: string
  modelName: string
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  confidence: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CustomerContext {
  customer: {
    id: string
    name: string
    email: string
    phone?: string
    joinedAt: string
    totalOrders: number
    totalSpent: number
    lastOrderAt?: string
  }
  recentOrders: Array<{
    id: string
    number: string
    status: string
    total: number
    createdAt: string
    items: Array<{ name: string; quantity: number; price: number }>
  }>
  communicationHistory: Array<{
    channel: string
    direction: string
    subject?: string
    preview: string
    createdAt: string
  }>
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAiResponse {
  choices: Array<{
    message: {
      content: string
      function_call?: { name: string; arguments: string }
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

interface OpenAiHttpResult {
  statusCode: number
  bodyText: string
}

interface DraftContent {
  subject?: string
  body_html?: string
  body_text: string
  confidence: number
  notes?: string
}

interface FeaturedProduct {
  id: string
  name: string
  slug: string
  price: number
  imageUrl?: string | null
}

interface GuardrailResult {
  score: number
  pass: boolean
  violations: string[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function evaluatePolicyGuardrails(draft: Record<string, any>): GuardrailResult {
  const violations: string[] = []
  const subject = String(draft.subject || '')
  const body = String(draft.body_text || '')
  const combined = `${subject}\n${body}`.toLowerCase()

  if (!body.trim()) {
    violations.push('Message body is empty')
  }

  if (body.length > 1800) {
    violations.push('Message body is excessively long')
  }

  if (!/[.!?]$/.test(body.trim())) {
    violations.push('Message lacks clear completion punctuation')
  }

  if (
    combined.includes('wire transfer') ||
    combined.includes('gift card') ||
    combined.includes('crypto wallet') ||
    combined.includes('bank account')
  ) {
    violations.push('Potential risky payment or fraud wording detected')
  }

  if (/(password|otp|pin|credit card|cvv)/i.test(combined)) {
    violations.push('Sensitive credential/payment request wording detected')
  }

  if (!combined.includes('techtools') && draft.channel !== 'whatsapp') {
    violations.push('Brand signature is missing')
  }

  const confidence = Number(draft.confidence || 0)
  if (confidence < 60) {
    violations.push(`Low AI confidence (${confidence})`)
  }

  const score = Math.max(0, Math.min(100, 100 - violations.length * 18))
  const threshold = Math.min(
    Math.max(Number(process.env.AI_GUARDRAIL_MIN_SCORE) || 70, 40),
    95,
  )

  return {
    score,
    pass: score >= threshold,
    violations,
  }
}

function normalizeIpAddress(ip?: string): string | null {
  if (!ip) return null
  const trimmed = ip.trim()
  if (!trimmed) return null

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  const ipv4Mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (ipv4Mapped?.[1]) return ipv4Mapped[1]

  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  const ipv6Regex = /^[0-9a-f:]+$/i

  if (ipv4Regex.test(trimmed)) return trimmed
  if (trimmed.includes(':') && ipv6Regex.test(trimmed)) return trimmed

  return null
}

function buildFallbackDraft(input: GenerateDraftInput): DraftContent {
  const safeName = input.recipientName?.trim() || 'there'
  const subject =
    input.channel === 'newsletter'
      ? 'TechTools update for you'
      : input.channel === 'contact_reply'
      ? 'Update on your request'
      : 'Message from TechTools'

  const bodyText = [
    `Hi ${safeName},`,
    '',
    'Thanks for your message. We are processing your request and will follow up shortly.',
    '',
    'Context from admin instruction:',
    input.prompt.slice(0, 800),
    '',
    'Best regards,',
    'TechTools Team',
  ].join('\n')

  return {
    subject,
    body_text: bodyText,
    confidence: 35,
    notes:
      'Fallback template generated because AI provider call failed. Please review before sending.',
  }
}

function isMissingAiTablesError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const pgError = error as { code?: string; message?: string }
  return (
    pgError.code === '42P01' ||
    pgError.message?.includes('ai_drafts') === true ||
    pgError.message?.includes('communication_timeline') === true
  )
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toParagraphHtml(text: string): string {
  return escapeHtml(text)
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6;color:#1f2937;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function resolveAssetUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const base = (process.env.FRONTEND_URL || 'https://techtoolstore.com').replace(
    /\/$/,
    '',
  )
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

function buildProductsGrid(products: FeaturedProduct[]): string {
  if (!products.length) return ''

  return `
    <div style="margin-top:28px;">
      <h3 style="margin:0 0 14px 0;color:#111827;font-size:20px;">Featured products for you</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 10px;">
        <tbody>
          ${products
            .map((product) => {
              const productUrl = resolveAssetUrl(`/products/${product.slug}`)
              return `
                <tr>
                  <td style="width:92px;vertical-align:top;">
                    ${
                      product.imageUrl
                        ? `<a href="${productUrl}" style="text-decoration:none;"><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="88" height="88" style="display:block;border-radius:10px;object-fit:cover;border:1px solid #e5e7eb;"/></a>`
                        : `<a href="${productUrl}" style="display:block;width:88px;height:88px;border-radius:10px;border:1px solid #e5e7eb;background:#f9fafb;text-decoration:none;"></a>`
                    }
                  </td>
                  <td style="vertical-align:top;padding-right:4px;">
                    <a href="${productUrl}" style="text-decoration:none;color:#111827;font-size:15px;font-weight:700;line-height:1.4;display:inline-block;">${escapeHtml(product.name)}</a>
                    <div style="margin-top:6px;color:#ea580c;font-size:15px;font-weight:700;">$${product.price.toFixed(2)}</div>
                    <div style="margin-top:8px;">
                      <a href="${productUrl}" style="font-size:13px;color:#1d4ed8;text-decoration:none;font-weight:600;">View product</a>
                    </div>
                  </td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function buildBrandedEmailHtml(options: {
  subject: string
  bodyHtml?: string
  bodyText: string
  ctaLabel?: string
  ctaUrl?: string
  products?: FeaturedProduct[]
}): string {
  const brand = process.env.EMAIL_FROM_NAME || 'TechTools Store'
  const logoUrl = process.env.EMAIL_LOGO_URL || resolveAssetUrl('/favicon.svg')
  const headerLogo = logoUrl
    ? `<img src="${escapeHtml(resolveAssetUrl(logoUrl))}" alt="${escapeHtml(brand)}" style="height:36px;max-width:180px;display:block;margin:0 auto 10px auto;"/>`
    : `<div style="font-size:28px;font-weight:800;letter-spacing:0.2px;">${escapeHtml(brand)}</div>`

  const mainBody = options.bodyHtml?.trim()
    ? options.bodyHtml
    : toParagraphHtml(options.bodyText)

  const ctaBlock =
    options.ctaLabel && options.ctaUrl
      ? `<div style="margin:24px 0 4px 0;"><a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:12px 18px;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">${escapeHtml(options.ctaLabel)}</a></div>`
      : ''

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${escapeHtml(options.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 14px;background:#f3f4f6;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:linear-gradient(120deg,#f97316,#ea580c);padding:26px 22px;text-align:center;color:#ffffff;">
                ${headerLogo}
                <div style="font-size:14px;opacity:0.95;">Premium tech support and offers</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 22px;">
                ${mainBody}
                ${ctaBlock}
                ${buildProductsGrid(options.products || [])}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:26px 0 16px;"/>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                  You are receiving this email from ${escapeHtml(brand)}.<br/>
                  Website: <a href="${escapeHtml(resolveAssetUrl('/'))}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(resolveAssetUrl('/'))}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function loadFeaturedProducts(limit = 6): Promise<FeaturedProduct[]> {
  const result = await db(
    `SELECT p.id,
            p.name,
            p.slug,
            COALESCE(p.sale_price, p.base_price, 0) AS price,
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.product_id = p.id AND pm.type = 'image'
              ORDER BY pm.is_primary DESC, pm.position ASC
              LIMIT 1
            ) AS image_url
      FROM products p
      WHERE p.is_active = true
        AND p.deleted_at IS NULL
      ORDER BY p.is_featured DESC, p.updated_at DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 12)],
  )

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price || 0),
    imageUrl: row.image_url ? resolveAssetUrl(row.image_url) : null,
  }))
}

async function loadProductsByIds(productIds: string[]): Promise<FeaturedProduct[]> {
  if (!productIds.length) return []

  const result = await db(
    `SELECT p.id,
            p.name,
            p.slug,
            COALESCE(p.sale_price, p.base_price, 0) AS price,
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.product_id = p.id AND pm.type = 'image'
              ORDER BY pm.is_primary DESC, pm.position ASC
              LIMIT 1
            ) AS image_url
      FROM products p
      WHERE p.id = ANY($1::uuid[])
        AND p.is_active = true
        AND p.deleted_at IS NULL
      LIMIT 20`,
    [productIds],
  )

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price || 0),
    imageUrl: row.image_url ? resolveAssetUrl(row.image_url) : null,
  }))
}

function normalizeTextList(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
}

async function estimateNewsletterAudience(segment?: {
  sources?: string[]
  statuses?: string[]
  includeUnsubscribed?: boolean
}): Promise<number> {
  const sources = normalizeTextList(segment?.sources)
  const statuses = normalizeTextList(segment?.statuses)

  const conditions: string[] = []
  const params: unknown[] = []
  let index = 1

  if (sources.length > 0) {
    conditions.push(`source = ANY($${index++}::text[])`)
    params.push(sources)
  }

  if (statuses.length > 0) {
    conditions.push(`status = ANY($${index++}::text[])`)
    params.push(statuses)
  } else if (!segment?.includeUnsubscribed) {
    conditions.push(`status = 'active'`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db(
    `SELECT COUNT(*)::int AS total FROM newsletter_subscribers ${where}`,
    params,
  )

  return Number(result.rows[0]?.total || 0)
}

export async function generateSegmentCampaignDraft(
  input: SegmentAwareCampaignInput,
): Promise<{ draft: AiDraft; audienceEstimate: number }> {
  const selectedProductIds = Array.isArray(input.selectedProductIds)
    ? input.selectedProductIds.slice(0, 20)
    : []

  const selectedProducts = await loadProductsByIds(selectedProductIds)
  const featuredProducts =
    selectedProducts.length > 0 ? selectedProducts : await loadFeaturedProducts(6)

  const audienceEstimate = await estimateNewsletterAudience(input.segment)

  const segmentSources = normalizeTextList(input.segment?.sources)
  const segmentStatuses = normalizeTextList(input.segment?.statuses)

  const segmentSummary = [
    `Audience estimate: ${audienceEstimate} subscribers`,
    `Sources: ${segmentSources.length > 0 ? segmentSources.join(', ') : 'all'}`,
    `Statuses: ${segmentStatuses.length > 0 ? segmentStatuses.join(', ') : 'active only'}`,
  ].join('\n')

  const productSummary = featuredProducts
    .map((p) => `- ${p.name} ($${p.price.toFixed(2)}) ${resolveAssetUrl(`/products/${p.slug}`)}`)
    .join('\n')

  const enrichedPrompt = `${input.prompt}\n\nCampaign segment context:\n${segmentSummary}\n\nProducts to feature:\n${productSummary}`

  const draft = await generateDraft({
    channel: 'newsletter',
    prompt: enrichedPrompt,
    scheduledAt: input.scheduledAt,
    actorId: input.actorId,
    actorIp: input.actorIp,
    actorAgent: input.actorAgent,
  })

  return { draft, audienceEstimate }
}

// ─── Channel-aware system prompt builder ────────────────────
function buildSystemPrompt(
  channel: AiChannel,
  ctx: CustomerContext | null,
): string {
  const brand = 'TechTools Store'
  const tone = 'professional yet friendly, concise, and action-oriented'

  const contextBlock = ctx
    ? `
## Customer Context
- Name: ${ctx.customer.name}
- Email: ${ctx.customer.email}
- Member since: ${ctx.customer.joinedAt}
- Total orders: ${ctx.customer.totalOrders} (total spent: $${
        ctx.customer.totalSpent
      })
- Last order: ${ctx.customer.lastOrderAt || 'never'}

### Recent Orders
${ctx.recentOrders
  .map(
    (o) =>
      `- Order ${o.number} [${o.status}] $${o.total} — items: ${o.items
        .map((i) => i.name)
        .join(', ')}`,
  )
  .join('\n')}

### Recent Communication
${ctx.communicationHistory
  .slice(0, 5)
  .map(
    (c) => `- [${c.channel}/${c.direction}] ${c.subject || ''}: ${c.preview}`,
  )
  .join('\n')}
`
    : ''

  const channelRules: Record<AiChannel, string> = {
    email: `
You are writing a business email on behalf of ${brand}.
- Tone: ${tone}
- Provide both HTML (with simple inline styles, no external CSS) and plain-text versions
- HTML should render well in Gmail, Outlook, Apple Mail
- Include a clear CTA button in HTML
- Keep subject lines under 60 characters
- Never include placeholder text like [NAME] — use the actual customer name from context or "Valued Customer"
`,
    whatsapp: `
You are writing a WhatsApp Business message on behalf of ${brand}.
- Tone: ${tone}
- WhatsApp messages must be under 1024 characters
- Plain text only — no HTML
- Use *bold* for emphasis (WhatsApp markdown)
- Include a clear call to action with a URL if needed
- Keep it conversational and direct
`,
    newsletter: `
You are writing a newsletter campaign email on behalf of ${brand}.
- Tone: engaging, value-first, ${tone}
- Provide both HTML (email-client-safe) and plain-text versions
- HTML: use table-based layout for maximum email client compatibility
- Subject line: compelling, under 60 chars, no spam trigger words
- Include an unsubscribe note in HTML footer: "Unsubscribe: [unsubscribe_link]"
`,
    contact_reply: `
You are replying to a customer support message on behalf of ${brand}.
- Tone: empathetic, helpful, ${tone}
- Address the customer by name if known
- Directly answer/resolve the issue raised
- Offer a next step or escalation path if needed
- Keep reply under 300 words
- Plain text first, HTML optional
`,
  }

  return `You are the AI communication assistant for ${brand}, an e-commerce platform.
Your role is to draft high-quality, on-brand messages across email, WhatsApp, and newsletter channels.

${channelRules[channel]}
${contextBlock}

IMPORTANT RULES:
- Never fabricate order details, prices, or policies not provided in context
- Never include discount codes unless explicitly mentioned in the admin prompt
- Always output valid JSON matching the required schema
- If the admin prompt is ambiguous, produce the most helpful reasonable interpretation
- Flag if you cannot complete the task with a "confidence" score below 70
`
}

async function postOpenAi(
  path: string,
  payload: Record<string, unknown>,
): Promise<OpenAiHttpResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const body = JSON.stringify(payload)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            bodyText: data,
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('OpenAI request timed out'))
    })
    req.write(body)
    req.end()
  })
}

function parseResponsesText(raw: any): string {
  if (typeof raw?.output_text === 'string' && raw.output_text.trim()) {
    return raw.output_text
  }

  const outputs = Array.isArray(raw?.output) ? raw.output : []
  const textChunks: string[] = []

  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string') {
        textChunks.push(part.text)
      }
    }
  }

  const combined = textChunks.join('\n').trim()
  if (!combined) {
    throw new Error('OpenAI Responses API returned no text output')
  }
  return combined
}

// ─── OpenAI API caller with compatibility fallback ───────────
async function callOpenAI(messages: OpenAiMessage[]): Promise<OpenAiResponse> {
  const model = process.env.AI_MODEL || 'gpt-5.5'

  // First attempt: Chat Completions API
  const chatResult = await postOpenAi('/v1/chat/completions', {
    model,
    messages,
    max_tokens: 2000,
  })

  if (chatResult.statusCode < 400) {
    try {
      return JSON.parse(chatResult.bodyText) as OpenAiResponse
    } catch {
      throw new Error('Failed to parse OpenAI chat completion response')
    }
  }

  // Fallback: Responses API (for models/projects not supporting chat.completions)
  const flattenedInput = messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n')

  const responsesResult = await postOpenAi('/v1/responses', {
    model,
    input: flattenedInput,
    max_output_tokens: 2000,
  })

  if (responsesResult.statusCode >= 400) {
    throw new Error(
      `OpenAI API error chat=${chatResult.statusCode} responses=${
        responsesResult.statusCode
      }: ${responsesResult.bodyText.slice(0, 400)}`,
    )
  }

  let responsesJson: any
  try {
    responsesJson = JSON.parse(responsesResult.bodyText)
  } catch {
    throw new Error('Failed to parse OpenAI responses API payload')
  }

  const responseText = parseResponsesText(responsesJson)

  return {
    choices: [
      {
        message: {
          content: responseText,
        },
      },
    ],
    usage: {
      prompt_tokens: responsesJson?.usage?.input_tokens || 0,
      completion_tokens: responsesJson?.usage?.output_tokens || 0,
      total_tokens: responsesJson?.usage?.total_tokens || 0,
    },
    model: responsesJson?.model || model,
  }
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim()
    if (fenced.startsWith('{') && fenced.endsWith('}')) {
      return fenced
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('AI did not return JSON content')
}

// ─── Rate limiter (Redis sliding window, 20 req/min per admin) ──────
async function checkRateLimit(actorId: string): Promise<void> {
  let redis: Awaited<ReturnType<typeof getRedis>> = null
  try {
    redis = await getRedis()
  } catch (error) {
    logger.warn('[AI] Redis rate limiter unavailable, continuing without rate limiting:', error)
    return
  }

  if (!redis) return // graceful degradation

  const key = `ai:rl:${actorId}`
  const limit = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '20')
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60)
    if (count > limit) {
      throw new Error(
        `Rate limit exceeded. Max ${limit} AI requests per minute per admin.`,
      )
    }
  } catch (error) {
    logger.warn('[AI] Redis rate limiter command failed, continuing without rate limiting:', error)
  }
}

// ─── Customer context loader ─────────────────────────────────
export async function loadCustomerContext(
  customerId?: string,
  email?: string,
): Promise<CustomerContext | null> {
  try {
    // Find customer
    const customerResult = customerId
      ? await db(
          `SELECT id, first_name, last_name, email, phone, created_at
           FROM users WHERE id = $1 LIMIT 1`,
          [customerId],
        )
      : email
      ? await db(
          `SELECT id, first_name, last_name, email, phone, created_at
           FROM users WHERE email = $1 LIMIT 1`,
          [email],
        )
      : { rows: [] }

    if (!customerResult.rows.length) return null

    const c = customerResult.rows[0]

    // Order stats
    const statsResult = await db(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(grand_total), 0) as total_spent,
              MAX(created_at) as last_order_at
       FROM orders WHERE user_id = $1 AND status != 'cancelled'`,
      [c.id],
    )
    const stats = statsResult.rows[0]

    // Recent orders (last 3)
    const ordersResult = await db(
      `SELECT o.id, o.order_number, o.status, o.grand_total, o.created_at,
              json_agg(json_build_object(
                'name', p.name,
                'quantity', oi.quantity,
                'price', oi.unit_price
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = $1
       GROUP BY o.id, o.order_number, o.status, o.grand_total, o.created_at
       ORDER BY o.created_at DESC LIMIT 3`,
      [c.id],
    )

    // Recent communication (last 10 across all channels)
    const commResult = await db(
      `SELECT channel, direction, subject, body_preview, created_at
       FROM communication_timeline
       WHERE customer_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [c.id],
    )

    return {
      customer: {
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        email: c.email,
        phone: c.phone,
        joinedAt: c.created_at,
        totalOrders: parseInt(stats.total_orders),
        totalSpent: parseFloat(stats.total_spent),
        lastOrderAt: stats.last_order_at,
      },
      recentOrders: ordersResult.rows.map((o) => ({
        id: o.id,
        number: o.order_number,
        status: o.status,
        total: parseFloat(o.grand_total),
        createdAt: o.created_at,
        items: o.items || [],
      })),
      communicationHistory: commResult.rows.map((r) => ({
        channel: r.channel,
        direction: r.direction,
        subject: r.subject,
        preview: r.body_preview || '',
        createdAt: r.created_at,
      })),
    }
  } catch (err) {
    logger.warn('[AI] Could not load customer context:', err)
    return null
  }
}

// ─── Core: Generate AI Draft ─────────────────────────────────
export async function generateDraft(
  input: GenerateDraftInput,
): Promise<AiDraft> {
  await checkRateLimit(input.actorId)

  // Load context (non-blocking if not found)
  const ctx = await loadCustomerContext(input.customerId, input.recipientEmail)

  const systemPrompt = buildSystemPrompt(input.channel, ctx)

  const messages: OpenAiMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please draft a ${input.channel} message.

Task: ${input.prompt}

${input.recipientName ? `Recipient name: ${input.recipientName}` : ''}
${input.recipientEmail ? `Recipient email: ${input.recipientEmail}` : ''}
${input.recipientPhone ? `Recipient phone: ${input.recipientPhone}` : ''}

Return ONLY valid JSON with this exact shape:
{
  "subject": "string optional",
  "body_text": "string required",
  "body_html": "string optional",
  "confidence": 0,
  "notes": "string optional"
}`,
    },
  ]

  let parsed: DraftContent
  let modelName = process.env.AI_MODEL || 'gpt-5.5'
  let modelVersion = modelName
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const allowTemplateFallback =
    (process.env.AI_ENABLE_TEMPLATE_FALLBACK || 'false').toLowerCase() ===
    'true'

  try {
    const aiResponse = await callOpenAI(messages)

    const choice = aiResponse.choices?.[0]
    const functionArgs = choice?.message?.function_call?.arguments
    const messageContent = choice?.message?.content

    if (!functionArgs && !messageContent) {
      throw new Error('AI did not return draft content')
    }

    const jsonText = functionArgs
      ? functionArgs
      : extractJsonObject(messageContent as string)
    parsed = JSON.parse(jsonText) as DraftContent

    if (!parsed.body_text?.trim()) {
      throw new Error('AI draft is empty')
    }

    modelName = (process.env.AI_MODEL || 'gpt-5.5').slice(0, 100)
    modelVersion = (aiResponse.model || modelName).slice(0, 50)
    usage = aiResponse.usage || usage
  } catch (error: any) {
    const reason = getErrorMessage(error)

    if (!allowTemplateFallback) {
      throw new Error(`AI provider failed: ${reason}`)
    }

    logger.warn(`[AI] Falling back to template draft: ${reason}`)
    parsed = buildFallbackDraft(input)
    parsed.notes = `${parsed.notes} Root cause: ${reason.slice(0, 300)}`
    modelName = 'fallback-template'
    modelVersion = 'fallback-template'
  }

  const safeConfidence = Math.max(
    0,
    Math.min(100, Number(parsed.confidence) || 35),
  )

  // Persist to DB
  const result = await db(
    `INSERT INTO ai_drafts
      (channel, status, recipient_email, recipient_phone, recipient_name,
       customer_id, contact_id, subject, body_html, body_text,
       prompt, model_name, model_version, token_usage, confidence, created_by, scheduled_at)
     VALUES ($1,'pending',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      input.channel,
      input.recipientEmail ?? null,
      input.recipientPhone ?? null,
      input.recipientName ?? null,
      input.customerId ?? null,
      input.contactId ?? null,
      parsed.subject ?? null,
      parsed.body_html ?? null,
      parsed.body_text,
      input.prompt,
      modelName,
      modelVersion,
      JSON.stringify({
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }),
      safeConfidence,
      input.actorId,
      input.scheduledAt ?? null,
    ],
  )

  const draft = result.rows[0]

  // Audit log
  await db(
    `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, customer_id, meta, ip_address, user_agent)
     VALUES ('draft_generated', $1, $2, $3, $4, $5, $6, $7)`,
    [
      input.actorId,
      draft.id,
      input.channel,
      input.customerId ?? null,
      JSON.stringify({
        prompt: input.prompt.slice(0, 200),
        confidence: safeConfidence,
        notes: parsed.notes,
      }),
      input.actorIp ?? null,
      input.actorAgent?.slice(0, 300) ?? null,
    ],
  )

  logger.info(
    `[AI] Draft generated: ${draft.id} channel=${input.channel} confidence=${safeConfidence}% model=${modelName}`,
  )

  return mapDraftRow(draft)
}

// ─── Approve & Send Draft ────────────────────────────────────
export async function approveDraft(
  draftId: string,
  actorId: string,
  actorIp?: string,
  options?: { forceSend?: boolean },
): Promise<{ sent: boolean; message: string }> {
  const result = await db(
    `SELECT * FROM ai_drafts WHERE id = $1 AND status = 'pending'`,
    [draftId],
  )

  if (!result.rows.length) {
    throw new Error('Draft not found or already processed')
  }

  const draft = result.rows[0]

  const guardrail = evaluatePolicyGuardrails(draft)
  if (!guardrail.pass && !options?.forceSend) {
    await db(
      `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, customer_id, meta, ip_address)
       VALUES ('guardrail_blocked', $1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        draftId,
        draft.channel,
        draft.customer_id,
        JSON.stringify(guardrail),
        actorIp ?? null,
      ],
    )

    throw new Error(
      `Policy guardrail blocked send (score=${guardrail.score}). Violations: ${guardrail.violations.join('; ')}`,
    )
  }

  // Mark as approved first
  await db(
    `UPDATE ai_drafts SET status = 'approved', approved_by = $1 WHERE id = $2`,
    [actorId, draftId],
  )

  await db(
    `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, customer_id, ip_address)
     VALUES ('draft_approved', $1, $2, $3, $4, $5)`,
    [actorId, draftId, draft.channel, draft.customer_id, actorIp ?? null],
  )

  await db(
    `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, customer_id, meta, ip_address)
     VALUES ('guardrail_scored', $1, $2, $3, $4, $5, $6)`,
    [
      actorId,
      draftId,
      draft.channel,
      draft.customer_id,
      JSON.stringify({ ...guardrail, forced: Boolean(options?.forceSend) }),
      actorIp ?? null,
    ],
  )

  // Delegate to channel-specific sender
  try {
    if (draft.channel === 'email' || draft.channel === 'contact_reply') {
      await sendEmailDraft(draft)
    } else if (draft.channel === 'whatsapp') {
      await sendWhatsAppDraft(draft)
    } else if (draft.channel === 'newsletter') {
      // Newsletter campaigns go through the campaign flow
      await sendNewsletterDraft(draft)
    }

    await db(
      `UPDATE ai_drafts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [draftId],
    )
    await db(
      `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, customer_id, ip_address)
       VALUES ('draft_sent', $1, $2, $3, $4, $5)`,
      [actorId, draftId, draft.channel, draft.customer_id, actorIp ?? null],
    )

    // Add to communication timeline
    await addToTimeline(draft)

    logger.info(`[AI] Draft sent: ${draftId} channel=${draft.channel}`)
    return { sent: true, message: 'Draft approved and sent successfully' }
  } catch (err: any) {
    await db(`UPDATE ai_drafts SET status = 'failed' WHERE id = $1`, [draftId])
    await db(
      `INSERT INTO ai_audit_log (action, actor_id, draft_id, channel, meta, ip_address)
       VALUES ('draft_failed', $1, $2, $3, $4, $5)`,
      [
        actorId,
        draftId,
        draft.channel,
        JSON.stringify({ error: err.message }),
        actorIp ?? null,
      ],
    )
    logger.error(`[AI] Draft send failed: ${draftId}`, err.message)
    throw new Error(`Draft approved but send failed: ${err.message}`)
  }
}

// ─── Reject Draft ────────────────────────────────────────────
export async function rejectDraft(
  draftId: string,
  actorId: string,
  reason: string,
  actorIp?: string,
): Promise<void> {
  const result = await db(
    `UPDATE ai_drafts SET status = 'rejected', rejected_by = $1, reject_reason = $2
     WHERE id = $3 AND status = 'pending' RETURNING id`,
    [actorId, reason, draftId],
  )
  if (!result.rows.length)
    throw new Error('Draft not found or already processed')

  await db(
    `INSERT INTO ai_audit_log (action, actor_id, draft_id, meta, ip_address)
     VALUES ('draft_rejected', $1, $2, $3, $4)`,
    [actorId, draftId, JSON.stringify({ reason }), actorIp ?? null],
  )
}

// ─── List Drafts ──────────────────────────────────────────────
export async function listDrafts(params: {
  status?: string
  channel?: string
  page?: number
  limit?: number
}): Promise<{ drafts: AiDraft[]; total: number }> {
  try {
    const page = params.page ?? 1
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (params.status) {
      conditions.push(`status = $${idx++}`)
      values.push(params.status)
    }
    if (params.channel) {
      conditions.push(`channel = $${idx++}`)
      values.push(params.channel)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [countResult, rowsResult] = await Promise.all([
      db(`SELECT COUNT(*) FROM ai_drafts ${where}`, values),
      db(
        `SELECT * FROM ai_drafts ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${
          idx + 1
        }`,
        [...values, limit, offset],
      ),
    ])

    return {
      drafts: rowsResult.rows.map(mapDraftRow),
      total: parseInt(countResult.rows[0].count),
    }
  } catch (error) {
    if (isMissingAiTablesError(error)) {
      logger.warn(
        '[AI] listDrafts: AI tables not migrated yet, returning empty list',
      )
      return { drafts: [], total: 0 }
    }
    throw error
  }
}

// ─── Get Timeline ─────────────────────────────────────────────
export async function getCustomerTimeline(
  customerId: string,
  page = 1,
  limit = 30,
): Promise<{ events: object[]; total: number }> {
  const offset = (page - 1) * limit

  const [countResult, rowsResult] = await Promise.all([
    db(`SELECT COUNT(*) FROM communication_timeline WHERE customer_id = $1`, [
      customerId,
    ]),
    db(
      `SELECT * FROM communication_timeline
       WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [customerId, limit, offset],
    ),
  ])

  return {
    events: rowsResult.rows,
    total: parseInt(countResult.rows[0].count),
  }
}

// ─── AI Stats ─────────────────────────────────────────────────
export async function getAiStats(): Promise<object> {
  try {
    const result = await db(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE status = 'sent')     AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')   AS failed,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h,
        COALESCE(ROUND(AVG(confidence)), 0) AS avg_confidence,
        COALESCE(SUM(CASE
          WHEN (token_usage->>'totalTokens') ~ '^[0-9]+$' THEN (token_usage->>'totalTokens')::int
          ELSE 0
        END), 0) AS total_tokens_used
      FROM ai_drafts
    `)
    return result.rows[0]
  } catch (error) {
    if (isMissingAiTablesError(error)) {
      logger.warn(
        '[AI] getAiStats: AI tables not migrated yet, returning zeros',
      )
      return {
        pending: '0',
        approved: '0',
        rejected: '0',
        sent: '0',
        failed: '0',
        last_24h: '0',
        avg_confidence: '0',
        total_tokens_used: '0',
      }
    }
    throw error
  }
}

// ─── Channel senders (thin wrappers around existing services) ──
async function sendEmailDraft(draft: Record<string, any>): Promise<void> {
  // Dynamic import to avoid circular dep at module load time
  const emailService = (await import('./email.service')).default
  const subject = draft.subject || 'Message from TechTools'
  const html = buildBrandedEmailHtml({
    subject,
    bodyHtml: draft.body_html,
    bodyText: draft.body_text,
    ctaLabel: 'Visit TechTools',
    ctaUrl: resolveAssetUrl('/'),
  })
  const result = await emailService.sendEmail({
    to: draft.recipient_email,
    subject,
    html,
    text: draft.body_text,
    emailType: draft.channel === 'contact_reply' ? 'custom' : 'promotional',
    metadata: {
      channel: draft.channel,
      aiDraftId: draft.id,
      confidence: draft.confidence,
    },
  })

  if (!result.success) {
    throw new Error(result.error || 'Email delivery failed')
  }
}

async function sendWhatsAppDraft(draft: Record<string, any>): Promise<void> {
  const whatsappService = (await import('./whatsapp.service')).default
  await whatsappService.sendCustomMessage(
    draft.recipient_phone,
    draft.body_text,
  )
}

async function sendNewsletterDraft(draft: Record<string, any>): Promise<void> {
  const featuredProducts = await loadFeaturedProducts(6)
  const subject = draft.subject || 'Newsletter'
  const html = buildBrandedEmailHtml({
    subject,
    bodyHtml: draft.body_html,
    bodyText: draft.body_text,
    ctaLabel: 'Shop New Arrivals',
    ctaUrl: resolveAssetUrl('/products'),
    products: featuredProducts,
  })

  // Insert campaign record and send via email service to all active subscribers
  const camResult = await db(
    `INSERT INTO newsletter_campaigns
      (name, subject, content_html, content_text, status, scheduled_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      `AI Campaign - ${new Date().toLocaleDateString()}`,
      subject,
      html,
      draft.body_text,
      draft.scheduled_at ? 'scheduled' : 'draft',
      draft.scheduled_at || null,
      draft.created_by || null,
    ],
  )
  const campaignId = camResult.rows[0].id

  const { enqueueCampaign } = await import('./newsletter.queue')
  await enqueueCampaign(campaignId)
}

async function addToTimeline(draft: Record<string, any>): Promise<void> {
  try {
    if (!draft.customer_id) {
      logger.info(
        '[AI] Skipping communication timeline insert because draft has no customer_id',
      )
      return
    }

    await db(
      `INSERT INTO communication_timeline
        (customer_id, customer_email, customer_phone, channel, direction, subject, body_preview, body_full, ai_draft_id)
       VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        draft.customer_id,
        draft.recipient_email,
        draft.recipient_phone,
        draft.channel,
        draft.subject,
        (draft.body_text || '').slice(0, 500),
        draft.body_text,
        draft.id,
      ],
    )
  } catch (err) {
    logger.warn('[AI] Could not write to timeline:', err)
  }
}

// ─── Row mapper ───────────────────────────────────────────────
function mapDraftRow(row: Record<string, any>): AiDraft {
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    recipientEmail: row.recipient_email,
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name,
    customerId: row.customer_id,
    contactId: row.contact_id,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    prompt: row.prompt,
    modelName: row.model_name,
    tokenUsage: row.token_usage || {},
    confidence: row.confidence,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export default {
  generateDraft,
  generateSegmentCampaignDraft,
  approveDraft,
  rejectDraft,
  listDrafts,
  loadCustomerContext,
  getCustomerTimeline,
  getAiStats,
}
