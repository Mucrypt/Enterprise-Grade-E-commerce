/**
 * Campaign CRUD, validation, scheduling, and publish orchestration.
 * Publishing itself is asynchronous (promotion-campaign.queue.ts) --
 * schedule()/publishNow() only ever flip row statuses and return
 * immediately, never block an HTTP response on any social API call.
 */
import { Response } from 'express'
import { randomUUID } from 'crypto'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import { getAdapter } from '../../../services/social-adapters/registry'
import { isDryRunDefault, reconcileCampaignStatuses } from '../../../services/promotion-campaign.queue'
import { SocialPlatform } from '../../../services/social-adapters/social-adapter.types'
import { buildUtmUrl } from './promotion.utm'
import { resolveStaffScope } from '../analytics/analytics-query.helpers'
import { campaignScopeFilter, isCampaignInScope, validateCampaignScopeForCreation } from './promotion-scope.helpers'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function generateCampaignKey(name: string): string {
  const base = slugify(name) || 'campaign'
  const suffix = randomUUID().slice(0, 8)
  return `${base}-${suffix}`
}

async function logActivity(campaignId: string, actorUserId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await query(
    `INSERT INTO promotion_activity_log (campaign_id, channel_post_id, actor_user_id, action, metadata)
     VALUES ($1, NULL, $2, $3, $4)`,
    [campaignId, actorUserId, action, JSON.stringify(metadata)],
  )
}

/**
 * IDOR guard shared by every direct-by-ID campaign route (Production
 * Review Round 1 §8) -- fetches the requested columns plus market_scope,
 * 404s if the campaign doesn't exist OR if it exists but is outside the
 * caller's own market scope (same "404, not 403" convention
 * order.controller.ts's assertOrderInScope() already uses -- never
 * confirms existence of an out-of-scope resource). A scoped caller who
 * lists campaigns already never sees an out-of-scope one (campaignScopeFilter
 * in listCampaigns); this closes the direct-ID path the list filter alone
 * doesn't cover.
 */
async function loadCampaignWithScopeCheck(
  req: StaffAuthRequest,
  res: Response,
  columns: string,
): Promise<Record<string, any> | null> {
  const result = await query(`SELECT ${columns}, market_scope FROM promotion_campaigns WHERE id = $1`, [req.params.id])
  const campaign = result.rows[0]
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' })
    return null
  }
  const scope = resolveStaffScope(req)
  if (!isCampaignInScope(scope, campaign.market_scope)) {
    res.status(404).json({ success: false, error: 'Campaign not found' })
    return null
  }
  return campaign
}

async function loadCampaignDetail(campaignId: string) {
  const campaignResult = await query(`SELECT * FROM promotion_campaigns WHERE id = $1`, [campaignId])
  if (campaignResult.rows.length === 0) return null
  const campaign = campaignResult.rows[0]

  const [productsResult, channelsResult] = await Promise.all([
    query(
      `SELECT id, product_id, display_order, snapshot_name, snapshot_slug, snapshot_price, snapshot_currency, snapshot_image_url
       FROM promotion_campaign_products WHERE campaign_id = $1 ORDER BY display_order ASC`,
      [campaignId],
    ),
    query(
      `SELECT id, channel, connection_id, status, message_override, hashtags, creative_asset_key, link_url,
              scheduled_at, published_at, remote_post_id, remote_permalink, last_error, last_error_code, attempt_count, max_retries,
              dry_run, validation_errors
       FROM promotion_channel_posts WHERE campaign_id = $1 ORDER BY channel ASC`,
      [campaignId],
    ),
  ])

  return {
    id: campaign.id,
    name: campaign.name,
    campaignKey: campaign.campaign_key,
    status: campaign.status,
    objective: campaign.objective,
    masterMessage: campaign.master_message,
    couponId: campaign.coupon_id,
    marketScope: campaign.market_scope,
    landingUrl: campaign.landing_url,
    creativeAssets: campaign.creative_assets || [],
    timezone: campaign.timezone,
    scheduledAt: campaign.scheduled_at,
    publishedAt: campaign.published_at,
    completedAt: campaign.completed_at,
    dryRun: campaign.dry_run,
    createdBy: campaign.created_by,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    products: productsResult.rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      displayOrder: r.display_order,
      name: r.snapshot_name,
      slug: r.snapshot_slug,
      price: r.snapshot_price,
      currency: r.snapshot_currency,
      imageUrl: r.snapshot_image_url,
    })),
    channels: channelsResult.rows.map((r: any) => ({
      id: r.id,
      channel: r.channel,
      connectionId: r.connection_id,
      status: r.status,
      messageOverride: r.message_override,
      hashtags: r.hashtags || [],
      creativeAssetKey: r.creative_asset_key,
      linkUrl: r.link_url,
      scheduledAt: r.scheduled_at,
      publishedAt: r.published_at,
      remotePostId: r.remote_post_id,
      remotePermalink: r.remote_permalink,
      lastError: r.last_error,
      lastErrorCode: r.last_error_code,
      attemptCount: r.attempt_count,
      maxRetries: r.max_retries,
      dryRun: r.dry_run,
      validationErrors: r.validation_errors,
    })),
  }
}

export const listCampaigns = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25))
    const offset = (page - 1) * pageSize

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (typeof req.query.status === 'string' && req.query.status) {
      conditions.push(`pc.status = $${idx++}`)
      params.push(req.query.status)
    }
    if (typeof req.query.search === 'string' && req.query.search) {
      conditions.push(`pc.name ILIKE $${idx++}`)
      params.push(`%${req.query.search}%`)
    }
    if (typeof req.query.channel === 'string' && req.query.channel) {
      conditions.push(`EXISTS (SELECT 1 FROM promotion_channel_posts cp WHERE cp.campaign_id = pc.id AND cp.channel = $${idx++})`)
      params.push(req.query.channel)
    }

    // Market-scope enforcement (Production Review Round 1 §8) -- a scoped
    // MARKETING_MANAGER must never see a global campaign or one scoped to
    // a different market, at the SQL layer, not filtered client-side.
    const scope = resolveStaffScope(req)
    const scopeFilter = campaignScopeFilter(scope, idx)
    if (scopeFilter.clause) {
      conditions.push(scopeFilter.clause.replace(/^AND /, ''))
      params.push(...scopeFilter.params)
      idx += scopeFilter.params.length
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rowsResult, countResult] = await Promise.all([
      query(
        `SELECT pc.id, pc.name, pc.campaign_key, pc.status, pc.objective, pc.scheduled_at, pc.published_at,
                pc.completed_at, pc.created_by, pc.created_at,
                (SELECT COUNT(*) FROM promotion_channel_posts cp WHERE cp.campaign_id = pc.id) as channel_count,
                (SELECT COUNT(*) FROM promotion_campaign_products pp WHERE pp.campaign_id = pc.id) as product_count
         FROM promotion_campaigns pc
         ${whereClause}
         ORDER BY pc.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, pageSize, offset],
      ),
      query(`SELECT COUNT(*) as total FROM promotion_campaigns pc ${whereClause}`, params),
    ])

    res.json({
      success: true,
      campaigns: rowsResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        campaignKey: r.campaign_key,
        status: r.status,
        objective: r.objective,
        scheduledAt: r.scheduled_at,
        publishedAt: r.published_at,
        completedAt: r.completed_at,
        createdBy: r.created_by,
        createdAt: r.created_at,
        channelCount: Number(r.channel_count),
        productCount: Number(r.product_count),
      })),
      pagination: { page, pageSize, total: Number(countResult.rows[0]?.total || 0) },
    })
  } catch (error) {
    logger.error('Error listing promotion campaigns:', error)
    res.status(500).json({ success: false, error: 'Failed to list campaigns' })
  }
}

export const getCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const scopeCheck = await loadCampaignWithScopeCheck(req, res, 'id')
    if (!scopeCheck) return

    const detail = await loadCampaignDetail(req.params.id)
    res.json({ success: true, campaign: detail })
  } catch (error) {
    logger.error('Error fetching promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch campaign' })
  }
}

export const createCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { name, objective, masterMessage, landingUrl, couponId, timezone, marketScope } = req.body
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: '"name" is required' })
      return
    }

    // Campaign-creation scope rules (Production Review Round 1 §9): a
    // global caller may create a global or explicitly-scoped campaign; a
    // scoped caller may only create a campaign scoped to a non-empty
    // subset of their own market_scope -- never global, never an empty
    // array, never a country outside it. Omitting marketScope entirely
    // defaults a scoped caller's own campaign to their own scope (the
    // natural default -- they can only ever operate in one market
    // anyway), and a global caller's to global (NULL).
    const scope = resolveStaffScope(req)
    const requestedMarketScope: string[] | null = Array.isArray(marketScope)
      ? marketScope
      : marketScope === null
        ? null
        : !scope.isGlobal
          ? scope.countries
          : null
    const scopeValidation = validateCampaignScopeForCreation(scope, requestedMarketScope)
    if (!scopeValidation.valid) {
      res.status(403).json({ success: false, error: scopeValidation.error })
      return
    }

    const campaignKey = generateCampaignKey(name)
    const result = await query(
      `INSERT INTO promotion_campaigns (name, campaign_key, objective, master_message, landing_url, coupon_id, timezone, market_scope, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        name.trim(),
        campaignKey,
        typeof objective === 'string' ? objective : null,
        typeof masterMessage === 'string' ? masterMessage : '',
        typeof landingUrl === 'string' ? landingUrl : null,
        typeof couponId === 'string' ? couponId : null,
        typeof timezone === 'string' ? timezone : 'UTC',
        requestedMarketScope,
        req.user!.userId,
      ],
    )
    const campaignId = result.rows[0].id
    await logActivity(campaignId, req.user!.userId, 'CAMPAIGN_CREATED', { name })

    const detail = await loadCampaignDetail(campaignId)
    res.status(201).json({ success: true, campaign: detail })
  } catch (error) {
    logger.error('Error creating promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to create campaign' })
  }
}

async function assertEditable(req: StaffAuthRequest, res: Response): Promise<Record<string, any> | null> {
  const campaign = await loadCampaignWithScopeCheck(req, res, 'id, status')
  if (!campaign) return null
  if (campaign.status !== 'DRAFT') {
    res.status(409).json({ success: false, error: `Campaign cannot be edited in status ${campaign.status} -- only DRAFT campaigns can be edited.` })
    return null
  }
  return campaign
}

export const updateCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const campaign = await assertEditable(req, res)
    if (!campaign) return

    const { name, objective, masterMessage, landingUrl, couponId, timezone, creativeAssets, products, channels } = req.body

    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1
    if (typeof name === 'string') { setClauses.push(`name = $${idx++}`); params.push(name.trim()) }
    if (objective === null || typeof objective === 'string') { setClauses.push(`objective = $${idx++}`); params.push(objective) }
    if (typeof masterMessage === 'string') { setClauses.push(`master_message = $${idx++}`); params.push(masterMessage) }
    if (landingUrl === null || typeof landingUrl === 'string') { setClauses.push(`landing_url = $${idx++}`); params.push(landingUrl) }
    if (couponId === null || typeof couponId === 'string') { setClauses.push(`coupon_id = $${idx++}`); params.push(couponId) }
    if (typeof timezone === 'string') { setClauses.push(`timezone = $${idx++}`); params.push(timezone) }
    if (Array.isArray(creativeAssets)) { setClauses.push(`creative_assets = $${idx++}`); params.push(JSON.stringify(creativeAssets)) }

    if (setClauses.length > 0) {
      setClauses.push(`updated_by = $${idx++}`)
      params.push(req.user!.userId)
      setClauses.push(`updated_at = now()`)
      params.push(campaign.id)
      await query(`UPDATE promotion_campaigns SET ${setClauses.join(', ')} WHERE id = $${idx}`, params)
    }

    if (Array.isArray(products)) {
      await query(`DELETE FROM promotion_campaign_products WHERE campaign_id = $1`, [campaign.id])
      let order = 0
      for (const p of products) {
        if (typeof p.productId !== 'string') continue
        const productResult = await query(
          `SELECT name, slug, sale_price, base_price FROM products WHERE id = $1 AND deleted_at IS NULL`,
          [p.productId],
        )
        const product = productResult.rows[0]
        if (!product) continue
        const imageResult = await query(
          `SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, display_order ASC LIMIT 1`,
          [p.productId],
        )
        await query(
          `INSERT INTO promotion_campaign_products (campaign_id, product_id, display_order, snapshot_name, snapshot_slug, snapshot_price, snapshot_image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            campaign.id,
            p.productId,
            order++,
            product.name,
            product.slug,
            product.sale_price ?? product.base_price,
            imageResult.rows[0]?.image_url || null,
          ],
        )
      }
    }

    if (Array.isArray(channels)) {
      const selected = new Set(channels.map((c: any) => c.channel))
      await query(
        `DELETE FROM promotion_channel_posts WHERE campaign_id = $1 AND channel != ALL($2) AND status = 'DRAFT'`,
        [campaign.id, Array.from(selected)],
      )
      for (const c of channels) {
        if (typeof c.channel !== 'string') continue
        await query(
          `INSERT INTO promotion_channel_posts (campaign_id, channel, connection_id, message_override, hashtags, creative_asset_key, scheduled_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (campaign_id, channel) DO UPDATE SET
             connection_id = EXCLUDED.connection_id,
             message_override = EXCLUDED.message_override,
             hashtags = EXCLUDED.hashtags,
             creative_asset_key = EXCLUDED.creative_asset_key,
             scheduled_at = EXCLUDED.scheduled_at,
             updated_at = now()
           WHERE promotion_channel_posts.status = 'DRAFT'`,
          [
            campaign.id,
            c.channel,
            typeof c.connectionId === 'string' ? c.connectionId : null,
            typeof c.messageOverride === 'string' ? c.messageOverride : null,
            Array.isArray(c.hashtags) ? c.hashtags : [],
            typeof c.creativeAssetKey === 'string' ? c.creativeAssetKey : null,
            c.scheduledAt || null,
          ],
        )
      }
    }

    await logActivity(campaign.id, req.user!.userId, 'CAMPAIGN_UPDATED', {})
    const detail = await loadCampaignDetail(campaign.id)
    res.json({ success: true, campaign: detail })
  } catch (error) {
    logger.error('Error updating promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to update campaign' })
  }
}

export const validateCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const scopeCheck = await loadCampaignWithScopeCheck(req, res, 'id')
    if (!scopeCheck) return
    const detail = await loadCampaignDetail(req.params.id)
    if (!detail) {
      res.status(404).json({ success: false, error: 'Campaign not found' })
      return
    }

    const mediaCount = detail.creativeAssets.length
    const mediaTypes = detail.creativeAssets.map((a: any) => (a.mediaType === 'video' ? 'video' : 'image')) as ('image' | 'video')[]

    const results: Record<string, { valid: boolean; errors: string[]; warnings: string[] }> = {}
    for (const channelPost of detail.channels) {
      const adapter = getAdapter(channelPost.channel as SocialPlatform)
      const capabilities = adapter.getCapabilities()
      const message = channelPost.messageOverride ?? detail.masterMessage

      const errors: string[] = []
      const warnings: string[] = []

      if (capabilities.readiness !== 'AVAILABLE') {
        errors.push(`${channelPost.channel} is not configured in this environment (${capabilities.readiness}).`)
      } else if (capabilities.requiresAppReview) {
        warnings.push(`${channelPost.channel} requires completed platform app review before publishing may actually succeed.`)
      }
      if (!channelPost.connectionId) {
        errors.push('No connected account selected for this channel.')
      }

      const contentValidation = adapter.validatePost({
        message,
        hashtags: channelPost.hashtags,
        mediaCount,
        mediaTypes,
        hasLink: Boolean(detail.landingUrl),
      })

      const combined = {
        valid: errors.length === 0 && contentValidation.valid,
        errors: [...errors, ...contentValidation.errors],
        warnings: [...warnings, ...contentValidation.warnings],
      }
      results[channelPost.channel] = combined

      await query(`UPDATE promotion_channel_posts SET validation_errors = $2, updated_at = now() WHERE id = $1`, [
        channelPost.id,
        JSON.stringify(combined),
      ])
    }

    res.json({ success: true, results })
  } catch (error) {
    logger.error('Error validating promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to validate campaign' })
  }
}

async function assignChannelLinksAndDryRun(campaignId: string, campaignKey: string, landingUrl: string | null): Promise<void> {
  const dryRun = isDryRunDefault()
  const channelsResult = await query(`SELECT id, channel FROM promotion_channel_posts WHERE campaign_id = $1`, [campaignId])
  for (const row of channelsResult.rows) {
    const linkUrl = landingUrl ? buildUtmUrl(landingUrl, { platform: row.channel, campaignKey, channelPostId: row.id }) : null
    await query(`UPDATE promotion_channel_posts SET link_url = $2, dry_run = $3, updated_at = now() WHERE id = $1`, [row.id, linkUrl, dryRun])
  }
  await query(`UPDATE promotion_campaigns SET dry_run = $2, updated_at = now() WHERE id = $1`, [campaignId, dryRun])
}

export const scheduleCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { scheduledAt } = req.body
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      res.status(400).json({ success: false, error: '"scheduledAt" must be a valid date/time' })
      return
    }
    const campaign = await loadCampaignWithScopeCheck(req, res, 'id, campaign_key, landing_url, status')
    if (!campaign) return
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      res.status(409).json({ success: false, error: `Campaign cannot be scheduled from status ${campaign.status}` })
      return
    }

    await assignChannelLinksAndDryRun(campaign.id, campaign.campaign_key, campaign.landing_url)
    await query(`UPDATE promotion_campaigns SET status = 'SCHEDULED', scheduled_at = $2, updated_at = now() WHERE id = $1`, [
      campaign.id,
      scheduledAt,
    ])
    await logActivity(campaign.id, req.user!.userId, 'CAMPAIGN_SCHEDULED', { scheduledAt })

    res.json({ success: true, message: 'Campaign scheduled.' })
  } catch (error) {
    logger.error('Error scheduling promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to schedule campaign' })
  }
}

export const publishCampaignNow = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const campaign = await loadCampaignWithScopeCheck(req, res, 'id, campaign_key, landing_url, status')
    if (!campaign) return
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      res.status(409).json({ success: false, error: `Campaign cannot be published from status ${campaign.status}` })
      return
    }

    const channelCountResult = await query(`SELECT COUNT(*) as count FROM promotion_channel_posts WHERE campaign_id = $1`, [campaign.id])
    const channelCount = Number(channelCountResult.rows[0]?.count || 0)
    if (channelCount === 0) {
      res.status(400).json({ success: false, error: 'Select at least one channel before publishing.' })
      return
    }

    await assignChannelLinksAndDryRun(campaign.id, campaign.campaign_key, campaign.landing_url)

    // Flip straight to QUEUED (not DRAFT) so the queue's very next tick
    // picks these up without waiting on a schedule check -- this request
    // never itself calls any social API, matching "do not block the HTTP
    // request waiting for every social API" (see promotion-campaign.queue.ts).
    await query(
      `UPDATE promotion_channel_posts SET status = 'QUEUED', queued_at = now(), updated_at = now() WHERE campaign_id = $1 AND status = 'DRAFT'`,
      [campaign.id],
    )
    await query(
      `UPDATE promotion_campaigns SET status = 'PUBLISHING', scheduled_at = now(), published_at = now(), updated_at = now() WHERE id = $1`,
      [campaign.id],
    )
    await logActivity(campaign.id, req.user!.userId, 'CAMPAIGN_PUBLISH_INITIATED', { channelCount })

    res.status(202).json({ success: true, message: `Campaign publication started to ${channelCount} channel(s).` })
  } catch (error) {
    logger.error('Error publishing promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to publish campaign' })
  }
}

export const cancelCampaign = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const campaign = await loadCampaignWithScopeCheck(req, res, 'id, status')
    if (!campaign) return
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      res.status(409).json({ success: false, error: `Campaign cannot be cancelled from status ${campaign.status} -- publishing has already started.` })
      return
    }

    await query(`UPDATE promotion_campaigns SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [campaign.id])
    await query(
      `UPDATE promotion_channel_posts SET status = 'CANCELLED', updated_at = now() WHERE campaign_id = $1 AND status IN ('DRAFT', 'QUEUED')`,
      [campaign.id],
    )
    await logActivity(campaign.id, req.user!.userId, 'CAMPAIGN_CANCELLED', {})

    res.json({ success: true, message: 'Campaign cancelled.' })
  } catch (error) {
    logger.error('Error cancelling promotion campaign:', error)
    res.status(500).json({ success: false, error: 'Failed to cancel campaign' })
  }
}

export const getCampaignActivity = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const scopeCheck = await loadCampaignWithScopeCheck(req, res, 'id')
    if (!scopeCheck) return

    const result = await query(
      `SELECT id, channel_post_id, actor_user_id, action, metadata, created_at
       FROM promotion_activity_log WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.params.id],
    )
    res.json({
      success: true,
      activity: result.rows.map((r: any) => ({
        id: r.id,
        channelPostId: r.channel_post_id,
        actorUserId: r.actor_user_id,
        action: r.action,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    })
  } catch (error) {
    logger.error('Error fetching promotion campaign activity log:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch activity log' })
  }
}

export const getCampaignMetrics = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const scopeCheck = await loadCampaignWithScopeCheck(req, res, 'id')
    if (!scopeCheck) return

    const channelsResult = await query(
      `SELECT id, channel, remote_post_id, remote_permalink, status, dry_run FROM promotion_channel_posts WHERE campaign_id = $1`,
      [req.params.id],
    )

    const channels = []
    for (const row of channelsResult.rows) {
      const snapshotResult = await query(
        `SELECT impressions, reach, likes, comments, shares, clicks, captured_at
         FROM social_metric_snapshots WHERE channel_post_id = $1 ORDER BY captured_at DESC LIMIT 1`,
        [row.id],
      )
      const latest = snapshotResult.rows[0] || null
      channels.push({
        channel: row.channel,
        status: row.status,
        remotePermalink: row.remote_permalink,
        dryRun: row.dry_run,
        metrics: latest
          ? {
              impressions: latest.impressions,
              reach: latest.reach,
              likes: latest.likes,
              comments: latest.comments,
              shares: latest.shares,
              clicks: latest.clicks,
              capturedAt: latest.captured_at,
            }
          : null,
      })
    }

    res.json({
      success: true,
      channels,
      dataQuality: {
        note:
          'Platform engagement metrics (impressions/reach/likes/etc.) are periodic snapshots from each provider\'s API where supported -- a null metric means that platform does not report it, not zero. For TechTools commerce attribution (sessions/orders/revenue driven by this campaign), see Analytics > Acquisition filtered by this campaign\'s UTM campaign key -- this endpoint intentionally does not duplicate that system.',
      },
    })
  } catch (error) {
    logger.error('Error fetching promotion campaign metrics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch campaign metrics' })
  }
}

/**
 * Human resolution for a channel post stuck in REQUIRES_ACTION (Production
 * Review Round 1 §4/§6) -- the queue itself never auto-retries an
 * ambiguous outcome, since a retry could create a real duplicate post if
 * the original attempt actually reached the provider. A staff member with
 * campaigns.manage must explicitly decide:
 *
 * - PUBLISHED: they verified (by checking the platform directly) that the
 *   post genuinely exists, and supplies its real remotePostId so this
 *   record matches reality.
 * - FAILED: they verified it does NOT exist -- terminal, matching what a
 *   normal DO_NOT_RETRY failure would have produced.
 * - RETRY: they've confirmed it's safe to attempt again (e.g. nothing was
 *   ever created) -- requeues for the next tick, resetting the backoff
 *   timer but not attempt_count, so max_retries is still respected.
 */
export const resolveChannelPost = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const scopeCheck = await loadCampaignWithScopeCheck(req, res, 'id')
    if (!scopeCheck) return

    const { outcome, remotePostId, remotePermalink } = req.body
    if (!['PUBLISHED', 'FAILED', 'RETRY'].includes(outcome)) {
      res.status(400).json({ success: false, error: '"outcome" must be one of PUBLISHED, FAILED, RETRY' })
      return
    }

    const channelResult = await query(
      `SELECT id, channel, status FROM promotion_channel_posts WHERE id = $1 AND campaign_id = $2`,
      [req.params.channelPostId, req.params.id],
    )
    const channelPost = channelResult.rows[0]
    if (!channelPost) {
      res.status(404).json({ success: false, error: 'Channel post not found' })
      return
    }
    if (channelPost.status !== 'REQUIRES_ACTION') {
      res.status(409).json({ success: false, error: `Channel post is not awaiting resolution (status: ${channelPost.status})` })
      return
    }

    if (outcome === 'PUBLISHED') {
      if (typeof remotePostId !== 'string' || !remotePostId.trim()) {
        res.status(400).json({ success: false, error: '"remotePostId" is required to confirm PUBLISHED' })
        return
      }
      await query(
        `UPDATE promotion_channel_posts
         SET status = 'PUBLISHED', remote_post_id = $2, remote_permalink = $3, published_at = now(),
             last_error = NULL, last_error_code = NULL, updated_at = now()
         WHERE id = $1`,
        [channelPost.id, remotePostId.trim(), typeof remotePermalink === 'string' ? remotePermalink : null],
      )
    } else if (outcome === 'FAILED') {
      await query(`UPDATE promotion_channel_posts SET status = 'FAILED', updated_at = now() WHERE id = $1`, [channelPost.id])
    } else {
      await query(
        `UPDATE promotion_channel_posts SET status = 'QUEUED', queued_at = now(), next_attempt_at = NULL, updated_at = now() WHERE id = $1`,
        [channelPost.id],
      )
    }

    await logActivity(req.params.id, req.user!.userId, 'CHANNEL_MANUALLY_RESOLVED', {
      channelPostId: channelPost.id,
      channel: channelPost.channel,
      outcome,
    })

    // A campaign parked at PARTIAL_SUCCESS because of this exact
    // REQUIRES_ACTION channel should re-settle now that it's resolved --
    // reuses the queue's own reconciliation logic rather than a second
    // implementation of the same rule.
    await reconcileCampaignStatuses([req.params.id])

    res.json({ success: true, message: 'Channel post resolved.' })
  } catch (error) {
    logger.error('Error resolving promotion channel post:', error)
    res.status(500).json({ success: false, error: 'Failed to resolve channel post' })
  }
}
