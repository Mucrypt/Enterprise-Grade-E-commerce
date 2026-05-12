import { query } from '../database/connection'
import { randomUUID } from 'crypto'
import emailService from './email.service'
import logger from '../utils/logger'

let queueStarted = false
let queueTimer: NodeJS.Timeout | null = null
let queueBusy = false

const DEFAULT_RATE_LIMIT_PER_MINUTE = Number.parseInt(
  process.env.NEWSLETTER_RATE_LIMIT_PER_MINUTE || '60',
  10,
)
const DEFAULT_MAX_RETRIES = Number.parseInt(
  process.env.NEWSLETTER_MAX_RETRIES || '3',
  10,
)
const DEFAULT_RETRY_BACKOFF_SECONDS = Number.parseInt(
  process.env.NEWSLETTER_RETRY_BACKOFF_SECONDS || '45',
  10,
)
const WORKER_INTERVAL_MS = Number.parseInt(
  process.env.NEWSLETTER_QUEUE_INTERVAL_MS || '15000',
  10,
)

interface CampaignQueueConfig {
  id: string
  subject: string
  content_html: string
  content_text: string | null
  ab_test_enabled: boolean
  subject_a: string | null
  subject_b: string | null
  content_html_a: string | null
  content_html_b: string | null
  content_text_a: string | null
  content_text_b: string | null
  segment_a: {
    sources?: string[]
    statuses?: string[]
  } | null
  segment_b: {
    sources?: string[]
    statuses?: string[]
  } | null
  ab_winner_variant: 'A' | 'B' | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_at: string | null
  rate_limit_per_minute: number
  max_retries: number
  retry_backoff_seconds: number
}

interface RecipientRow {
  id: string
  subscriber_id: string
  email: string
  name: string | null
  source: string | null
  subscriber_status: string | null
  variant_key: 'A' | 'B'
  attempt_count: number
  next_attempt_at: string | null
}

function toLowerTrim(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function inferProductSlug(url: string): string | null {
  const match = String(url || '').match(/\/products\/([a-z0-9-]+)/i)
  return match?.[1] ? toLowerTrim(match[1]) : null
}

function getTrackingBaseUrl(): string {
  const fallbackFrontend =
    (process.env.FRONTEND_URL || 'https://techtoolstore.com').replace(/\/$/, '')
  const configured =
    process.env.NEWSLETTER_TRACKING_BASE_URL || `${fallbackFrontend}/api/v1`

  return configured.replace(/\/$/, '')
}

function extractTrackableLinks(
  html: string,
): Array<{ url: string; position: number }> {
  const links: Array<{ url: string; position: number }> = []
  const regex = /href\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  let position = 0

  while ((match = regex.exec(html)) !== null) {
    const url = String(match[1] || '').trim()
    if (!url || url.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(url)) {
      continue
    }

    position += 1
    links.push({ url, position })
  }

  return links
}

function normalizeValues(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function isRecipientInSegment(
  recipient: RecipientRow,
  segment?: { sources?: string[]; statuses?: string[] } | null,
): boolean {
  if (!segment) return true

  const sources = normalizeValues(segment.sources)
  const statuses = normalizeValues(segment.statuses)
  const source = String(recipient.source || '').toLowerCase()
  const status = String(recipient.subscriber_status || '').toLowerCase()

  if (sources.length > 0 && !sources.includes(source)) {
    return false
  }

  if (statuses.length > 0 && !statuses.includes(status)) {
    return false
  }

  return true
}

function chooseVariantForRecipient(
  campaign: CampaignQueueConfig,
  recipient: RecipientRow,
): 'A' | 'B' {
  if (!campaign.ab_test_enabled) {
    return 'A'
  }

  const inA = isRecipientInSegment(recipient, campaign.segment_a)
  const inB = isRecipientInSegment(recipient, campaign.segment_b)

  if (inA && !inB) return 'A'
  if (inB && !inA) return 'B'

  const stableBucket = recipient.subscriber_id
    .replace(/-/g, '')
    .charCodeAt(0)
  return stableBucket % 2 === 0 ? 'A' : 'B'
}

function resolveVariantContent(
  campaign: CampaignQueueConfig,
  variantKey: 'A' | 'B',
): { subject: string; html: string; text?: string } {
  if (campaign.ab_winner_variant === 'A' || campaign.ab_winner_variant === 'B') {
    const winner = campaign.ab_winner_variant
    return winner === 'B'
      ? {
          subject: campaign.subject_b || campaign.subject,
          html: campaign.content_html_b || campaign.content_html,
          text: campaign.content_text_b || campaign.content_text || undefined,
        }
      : {
          subject: campaign.subject_a || campaign.subject,
          html: campaign.content_html_a || campaign.content_html,
          text: campaign.content_text_a || campaign.content_text || undefined,
        }
  }

  if (campaign.ab_test_enabled && variantKey === 'B') {
    return {
      subject: campaign.subject_b || campaign.subject,
      html: campaign.content_html_b || campaign.content_html,
      text: campaign.content_text_b || campaign.content_text || undefined,
    }
  }

  return {
    subject: campaign.subject_a || campaign.subject,
    html: campaign.content_html_a || campaign.content_html,
    text: campaign.content_text_a || campaign.content_text || undefined,
  }
}

function sanitizePositiveInt(value: number, fallback: number, max: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value) : fallback
  if (parsed <= 0) return fallback
  return Math.min(parsed, max)
}

async function promoteScheduledCampaigns(): Promise<void> {
  await query(
    `UPDATE newsletter_campaigns
     SET status = 'sending',
         processing_started_at = COALESCE(processing_started_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= CURRENT_TIMESTAMP`,
  )
}

async function ensureCampaignRecipients(campaignId: string): Promise<number> {
  const insertResult = await query(
    `INSERT INTO newsletter_campaign_recipients (campaign_id, subscriber_id, email, status, next_attempt_at)
     SELECT $1, ns.id, ns.email, 'pending', CURRENT_TIMESTAMP
     FROM newsletter_subscribers ns
     WHERE ns.status = 'active'
     ON CONFLICT (campaign_id, subscriber_id) DO NOTHING`,
    [campaignId],
  )

  const totalResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM newsletter_campaign_recipients
     WHERE campaign_id = $1`,
    [campaignId],
  )

  const total = Number(totalResult.rows[0]?.total || 0)

  await query(
    `UPDATE newsletter_campaigns
     SET total_recipients = $2,
         processing_started_at = COALESCE(processing_started_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [campaignId, total],
  )

  return Number(insertResult.rowCount || 0)
}

async function assignRecipientVariants(campaign: CampaignQueueConfig) {
  if (campaign.ab_winner_variant === 'A' || campaign.ab_winner_variant === 'B') {
    await query(
      `UPDATE newsletter_campaign_recipients
       SET variant_key = $2
       WHERE campaign_id = $1
         AND status = 'pending'`,
      [campaign.id, campaign.ab_winner_variant],
    )
    return
  }

  if (!campaign.ab_test_enabled) {
    await query(
      `UPDATE newsletter_campaign_recipients
       SET variant_key = 'A'
       WHERE campaign_id = $1
         AND variant_key <> 'A'`,
      [campaign.id],
    )
    return
  }

  const recipientsResult = await query(
    `SELECT r.id,
            r.subscriber_id,
            r.email,
            r.variant_key,
            s.name,
            s.source,
            s.status AS subscriber_status,
            r.attempt_count,
            r.next_attempt_at
     FROM newsletter_campaign_recipients r
     LEFT JOIN newsletter_subscribers s ON s.id = r.subscriber_id
     WHERE r.campaign_id = $1`,
    [campaign.id],
  )

  for (const recipient of recipientsResult.rows as RecipientRow[]) {
    const variantKey = chooseVariantForRecipient(campaign, recipient)
    if (recipient.variant_key === variantKey) {
      continue
    }

    await query(
      `UPDATE newsletter_campaign_recipients
       SET variant_key = $2
       WHERE id = $1`,
      [recipient.id, variantKey],
    )
  }
}

async function selectCampaignBatch(campaign: CampaignQueueConfig): Promise<RecipientRow[]> {
  const ratePerMinute = sanitizePositiveInt(
    campaign.rate_limit_per_minute,
    DEFAULT_RATE_LIMIT_PER_MINUTE,
    2000,
  )

  const batchSize = Math.max(1, Math.floor(ratePerMinute / 4))

  const result = await query(
    `SELECT r.id,
            r.subscriber_id,
            r.email,
            s.name,
            s.source,
            s.status AS subscriber_status,
            r.variant_key,
            r.attempt_count,
            r.next_attempt_at
     FROM newsletter_campaign_recipients r
     LEFT JOIN newsletter_subscribers s ON s.id = r.subscriber_id
     WHERE r.campaign_id = $1
       AND r.status = 'pending'
       AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= CURRENT_TIMESTAMP)
     ORDER BY r.created_at ASC
     LIMIT $2`,
    [campaign.id, batchSize],
  )

  return result.rows
}

async function applyLinkTracking(options: {
  campaignId: string
  recipient: RecipientRow
  variantKey: 'A' | 'B'
  html: string
  text?: string
}): Promise<{ html: string; text?: string }> {
  const links = extractTrackableLinks(options.html)
  if (links.length === 0) {
    return { html: options.html, text: options.text }
  }

  const trackingBase = getTrackingBaseUrl()
  let trackedHtml = options.html
  let trackedText = options.text

  for (const link of links) {
    const token = randomUUID()
    const redirectUrl = `${trackingBase}/newsletter/track/click/${token}`

    await query(
      `INSERT INTO newsletter_link_events
        (token, campaign_id, recipient_id, recipient_email, variant_key, destination_url, product_slug, link_position)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
      [
        token,
        options.campaignId,
        options.recipient.id,
        toLowerTrim(options.recipient.email),
        options.variantKey,
        link.url,
        inferProductSlug(link.url),
        link.position,
      ],
    )

    trackedHtml = trackedHtml.replace(link.url, redirectUrl)
    if (trackedText && trackedText.includes(link.url)) {
      trackedText = trackedText.replace(link.url, redirectUrl)
    }
  }

  return { html: trackedHtml, text: trackedText }
}

async function evaluateAbWinnerAndRollout(campaign: CampaignQueueConfig) {
  if (!campaign.ab_test_enabled || campaign.ab_winner_variant) {
    return
  }

  const minSample = Math.max(
    20,
    Number.parseInt(process.env.AB_AUTO_WINNER_MIN_SAMPLE || '80', 10) || 80,
  )
  const minDelta = Math.max(
    0.001,
    Number.parseFloat(process.env.AB_AUTO_WINNER_MIN_DELTA || '0.01') || 0.01,
  )

  const statsResult = await query(
    `WITH sent AS (
        SELECT variant_key, COUNT(*)::int AS sent_count
        FROM newsletter_campaign_recipients
        WHERE campaign_id = $1
          AND status IN ('sent', 'delivered', 'opened', 'clicked')
        GROUP BY variant_key
      ),
      clicks AS (
        SELECT variant_key, COUNT(DISTINCT recipient_id)::int AS clicked_count
        FROM newsletter_link_events
        WHERE campaign_id = $1
          AND clicked_at IS NOT NULL
        GROUP BY variant_key
      )
      SELECT
        s.variant_key,
        s.sent_count,
        COALESCE(c.clicked_count, 0)::int AS clicked_count,
        CASE WHEN s.sent_count > 0
          THEN COALESCE(c.clicked_count, 0)::decimal / s.sent_count
          ELSE 0::decimal
        END AS ctr
      FROM sent s
      LEFT JOIN clicks c ON c.variant_key = s.variant_key`,
    [campaign.id],
  )

  const byVariant: Record<string, { sent: number; clicked: number; ctr: number }> = {}
  let totalSent = 0

  for (const row of statsResult.rows) {
    const key = String(row.variant_key || '')
    byVariant[key] = {
      sent: Number(row.sent_count || 0),
      clicked: Number(row.clicked_count || 0),
      ctr: Number(row.ctr || 0),
    }
    totalSent += Number(row.sent_count || 0)
  }

  if (totalSent < minSample || !byVariant.A || !byVariant.B) {
    return
  }

  const delta = Math.abs(byVariant.A.ctr - byVariant.B.ctr)
  if (delta < minDelta) {
    return
  }

  const winner: 'A' | 'B' = byVariant.A.ctr >= byVariant.B.ctr ? 'A' : 'B'

  await query(
    `UPDATE newsletter_campaigns
     SET ab_winner_variant = $2,
         ab_rollout_at = CURRENT_TIMESTAMP,
         ab_test_enabled = false,
         subject = CASE WHEN $2 = 'B' THEN COALESCE(subject_b, subject) ELSE COALESCE(subject_a, subject) END,
         content_html = CASE WHEN $2 = 'B' THEN COALESCE(content_html_b, content_html) ELSE COALESCE(content_html_a, content_html) END,
         content_text = CASE WHEN $2 = 'B' THEN COALESCE(content_text_b, content_text) ELSE COALESCE(content_text_a, content_text) END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [campaign.id, winner],
  )

  await query(
    `UPDATE newsletter_campaign_recipients
     SET variant_key = $2
     WHERE campaign_id = $1
       AND status = 'pending'`,
    [campaign.id, winner],
  )

  logger.info('[NewsletterQueue] A/B winner selected and rolled out', {
    campaignId: campaign.id,
    winner,
    ctrA: byVariant.A.ctr,
    ctrB: byVariant.B.ctr,
    totalSent,
  })
}

async function markCampaignProgress(campaignId: string): Promise<void> {
  const stats = await query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced
     FROM newsletter_campaign_recipients
     WHERE campaign_id = $1`,
    [campaignId],
  )

  const row = stats.rows[0] || { pending: 0, sent: 0, bounced: 0 }

  const pending = Number(row.pending || 0)
  const sent = Number(row.sent || 0)
  const bounced = Number(row.bounced || 0)

  if (pending === 0) {
    await query(
      `UPDATE newsletter_campaigns
       SET status = 'sent',
           sent_at = CURRENT_TIMESTAMP,
           sent_count = $2,
           bounced_count = $3,
           last_processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [campaignId, sent, bounced],
    )
    return
  }

  await query(
    `UPDATE newsletter_campaigns
     SET sent_count = $2,
         bounced_count = $3,
         last_processed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [campaignId, sent, bounced],
  )
}

async function processRecipient(campaign: CampaignQueueConfig, recipient: RecipientRow) {
  const maxRetries = sanitizePositiveInt(
    campaign.max_retries,
    DEFAULT_MAX_RETRIES,
    10,
  )
  const backoffSeconds = sanitizePositiveInt(
    campaign.retry_backoff_seconds,
    DEFAULT_RETRY_BACKOFF_SECONDS,
    600,
  )

  const variant = resolveVariantContent(campaign, recipient.variant_key || 'A')
  const trackedVariant = await applyLinkTracking({
    campaignId: campaign.id,
    recipient,
    variantKey: recipient.variant_key || 'A',
    html: variant.html,
    text: variant.text,
  })

  const result = await emailService.sendEmail({
    to: recipient.email,
    toName: recipient.name || undefined,
    subject: variant.subject,
    html: trackedVariant.html,
    text: trackedVariant.text,
    emailType: 'promotional',
    metadata: {
      channel: 'newsletter',
      campaignId: campaign.id,
      recipientId: recipient.id,
      variant: recipient.variant_key,
      attempt: recipient.attempt_count + 1,
    },
  })

  if (result.success) {
    await query(
      `UPDATE newsletter_campaign_recipients
       SET status = 'sent',
           sent_at = CURRENT_TIMESTAMP,
           last_attempt_at = CURRENT_TIMESTAMP,
           attempt_count = attempt_count + 1,
           last_error = NULL
       WHERE id = $1`,
      [recipient.id],
    )
    return
  }

  const nextAttemptCount = Number(recipient.attempt_count || 0) + 1
  const errorMsg = (result.error || 'Unknown email delivery failure').slice(0, 800)

  if (nextAttemptCount >= maxRetries) {
    await query(
      `UPDATE newsletter_campaign_recipients
       SET status = 'bounced',
           last_attempt_at = CURRENT_TIMESTAMP,
           attempt_count = $2,
           last_error = $3
       WHERE id = $1`,
      [recipient.id, nextAttemptCount, errorMsg],
    )
    return
  }

  await query(
    `UPDATE newsletter_campaign_recipients
     SET status = 'pending',
         attempt_count = $2,
         last_attempt_at = CURRENT_TIMESTAMP,
         next_attempt_at = CURRENT_TIMESTAMP + make_interval(secs => ($3 * $2)),
         last_error = $4
     WHERE id = $1`,
    [recipient.id, nextAttemptCount, backoffSeconds, errorMsg],
  )
}

async function processCampaign(campaign: CampaignQueueConfig): Promise<void> {
  await ensureCampaignRecipients(campaign.id)
  await evaluateAbWinnerAndRollout(campaign)
  await assignRecipientVariants(campaign)

  const batch = await selectCampaignBatch(campaign)
  if (batch.length === 0) {
    await markCampaignProgress(campaign.id)
    return
  }

  for (const recipient of batch) {
    try {
      await processRecipient(campaign, recipient)
    } catch (error) {
      logger.error('[NewsletterQueue] Recipient processing error', {
        campaignId: campaign.id,
        recipientId: recipient.id,
        email: recipient.email,
        error,
      })

      await query(
        `UPDATE newsletter_campaign_recipients
         SET attempt_count = attempt_count + 1,
             last_attempt_at = CURRENT_TIMESTAMP,
             next_attempt_at = CURRENT_TIMESTAMP + '60 seconds'::interval,
             last_error = $2
         WHERE id = $1`,
        [recipient.id, (error instanceof Error ? error.message : String(error)).slice(0, 800)],
      )
    }
  }

  await markCampaignProgress(campaign.id)
}

async function processQueueTick(): Promise<void> {
  if (queueBusy) return
  queueBusy = true

  try {
    await promoteScheduledCampaigns()

    const campaignsResult = await query(
      `SELECT id,
              subject,
              content_html,
              content_text,
              ab_test_enabled,
              subject_a,
              subject_b,
              content_html_a,
              content_html_b,
              content_text_a,
              content_text_b,
              segment_a,
              segment_b,
              ab_winner_variant,
              status,
              scheduled_at,
              rate_limit_per_minute,
              max_retries,
              retry_backoff_seconds
       FROM newsletter_campaigns
       WHERE status = 'sending'
       ORDER BY updated_at ASC
       LIMIT 10`,
    )

    for (const campaign of campaignsResult.rows as CampaignQueueConfig[]) {
      await processCampaign(campaign)
    }
  } catch (error) {
    logger.error('[NewsletterQueue] Queue tick failed', error)
  } finally {
    queueBusy = false
  }
}

export async function enqueueCampaign(campaignId: string): Promise<{ totalRecipients: number }> {
  const campaignResult = await query(
    `SELECT id, status, scheduled_at
     FROM newsletter_campaigns
     WHERE id = $1`,
    [campaignId],
  )

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found')
  }

  const campaign = campaignResult.rows[0]
  if (campaign.status === 'sent') {
    throw new Error('Campaign has already been sent')
  }

  const subscribersResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM newsletter_subscribers
     WHERE status = 'active'`,
  )
  const totalRecipients = Number(subscribersResult.rows[0]?.total || 0)

  if (totalRecipients === 0) {
    throw new Error('No active subscribers to send to')
  }

  await query(
    `UPDATE newsletter_campaigns
     SET status = CASE
           WHEN scheduled_at IS NOT NULL AND scheduled_at > CURRENT_TIMESTAMP THEN 'scheduled'
           ELSE 'sending'
         END,
         total_recipients = $2,
         processing_started_at = CASE
           WHEN scheduled_at IS NOT NULL AND scheduled_at > CURRENT_TIMESTAMP THEN processing_started_at
           ELSE COALESCE(processing_started_at, CURRENT_TIMESTAMP)
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [campaignId, totalRecipients],
  )

  await ensureCampaignRecipients(campaignId)

  return { totalRecipients }
}

export function startNewsletterQueueWorker() {
  if (queueStarted) {
    return
  }

  queueStarted = true
  queueTimer = setInterval(() => {
    void processQueueTick()
  }, Math.max(5000, WORKER_INTERVAL_MS))

  void processQueueTick()

  logger.info(
    `[NewsletterQueue] Worker started (interval=${Math.max(5000, WORKER_INTERVAL_MS)}ms)`,
  )
}

export function stopNewsletterQueueWorker() {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  queueStarted = false
}
