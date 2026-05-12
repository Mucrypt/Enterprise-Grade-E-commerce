import { Request, Response } from 'express'
import { promises as dns } from 'dns'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import emailService from '../../../services/email.service'
import NotificationEvents from '../../../services/notification.events'
import { enqueueCampaign } from '../../../services/newsletter.queue'
import logger from '../../../utils/logger'

const buildNewsletterAdminAlertHtml = (data: {
  email: string
  name?: string | null
  source: string
  event: 'subscribed' | 'resubscribed'
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Activity</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:linear-gradient(135deg,#111827 0%,#f97316 100%);padding:28px 36px;color:#ffffff;">
        <h1 style="margin:0;font-size:24px;font-weight:700;">Newsletter ${
          data.event === 'subscribed' ? 'Subscription' : 'Reactivation'
        }</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.84);">A customer joined your mailing list.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 36px;">
        <p style="margin:0 0 12px;color:#0f172a;font-size:14px;"><strong>Email:</strong> ${
          data.email
        }</p>
        <p style="margin:0 0 12px;color:#0f172a;font-size:14px;"><strong>Name:</strong> ${
          data.name || 'Not provided'
        }</p>
        <p style="margin:0 0 12px;color:#0f172a;font-size:14px;"><strong>Source:</strong> ${
          data.source
        }</p>
        <p style="margin:0;color:#0f172a;font-size:14px;"><strong>Event:</strong> ${
          data.event
        }</p>
      </td>
    </tr>
  </table>
</body>
</html>`

const queueNewsletterSubscriptionSideEffects = (data: {
  subscriberId: string
  email: string
  name?: string | null
  source: string
  event: 'subscribed' | 'resubscribed'
}) => {
  setImmediate(async () => {
    try {
      await emailService.sendAdminNotification({
        subject:
          data.event === 'subscribed'
            ? `New newsletter subscriber: ${data.email}`
            : `Newsletter reactivation: ${data.email}`,
        html: buildNewsletterAdminAlertHtml({
          email: data.email,
          name: data.name || null,
          source: data.source,
          event: data.event,
        }),
        emailType: 'custom',
      })
    } catch (error) {
      logger.warn('Failed to send newsletter admin alert:', error)
    }

    try {
      await NotificationEvents.onNewsletterSubscription({
        email: data.email,
        name: data.name || null,
        source: data.source,
        event: data.event,
        subscriberId: data.subscriberId,
      })
    } catch (error) {
      logger.warn('Failed to create newsletter admin notification:', error)
    }

    if (data.event !== 'subscribed') {
      return
    }

    try {
      const settingsResult = await query(
        `SELECT setting_key, setting_value FROM newsletter_settings 
         WHERE setting_key IN ('welcome_email_enabled', 'welcome_subject', 'welcome_message', 'from_name', 'from_email')`,
      )

      const settings: Record<string, string> = {}
      settingsResult.rows.forEach((row) => {
        settings[row.setting_key] = row.setting_value
      })

      if (settings.welcome_email_enabled === 'true') {
        const sendResult = await emailService.sendEmail({
          to: data.email,
          toName: data.name || undefined,
          subject: settings.welcome_subject || 'Welcome to our Newsletter!',
          html: settings.welcome_message || '<p>Thank you for subscribing!</p>',
          emailType: 'promotional',
        })

        if (!sendResult.success) {
          logger.warn('Welcome email delivery failed:', {
            email: data.email,
            error: sendResult.error,
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to process newsletter welcome email:', error)
    }
  })
}

// =====================================================
// Public Endpoints
// =====================================================

/**
 * Subscribe to newsletter
 */
export const subscribe = async (req: Request, res: Response) => {
  try {
    const { email, name, source = 'website' } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      })
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.socket.remoteAddress || null
    const userAgent = req.headers['user-agent'] || null

    // Check if already subscribed
    const existingSubscriber = await query(
      'SELECT id, status FROM newsletter_subscribers WHERE email = $1',
      [email.toLowerCase()],
    )

    if (existingSubscriber.rows.length > 0) {
      const subscriber = existingSubscriber.rows[0]

      if (subscriber.status === 'active') {
        return res.json({
          success: true,
          message: 'You are already subscribed to our newsletter!',
          alreadySubscribed: true,
        })
      }

      // Reactivate unsubscribed user
      await query(
        `UPDATE newsletter_subscribers 
         SET status = 'active', 
             unsubscribed_at = NULL, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [subscriber.id],
      )

      queueNewsletterSubscriptionSideEffects({
        email: email.toLowerCase(),
        name: name || null,
        source,
        event: 'resubscribed',
        subscriberId: subscriber.id,
      })

      return res.json({
        success: true,
        message: 'Welcome back. Your newsletter subscription is active again.',
        resubscribed: true,
      })
    }

    // Insert new subscriber
    const result = await query(
      `INSERT INTO newsletter_subscribers (email, name, source, ip_address, user_agent, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id`,
      [email.toLowerCase(), name || null, source, ipAddress, userAgent],
    )

    queueNewsletterSubscriptionSideEffects({
      email: email.toLowerCase(),
      name: name || null,
      source,
      event: 'subscribed',
      subscriberId: result.rows[0].id,
    })

    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing. Your newsletter subscription is now active.',
      subscriberId: result.rows[0].id,
    })
  } catch (error) {
    logger.error('Newsletter subscribe error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to newsletter',
    })
  }
}

/**
 * Unsubscribe from newsletter
 */
export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    const result = await query(
      `UPDATE newsletter_subscribers 
       SET status = 'unsubscribed', 
           unsubscribed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP 
       WHERE email = $1 AND status = 'active'
       RETURNING id`,
      [email.toLowerCase()],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email not found or already unsubscribed',
      })
    }

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter.',
    })
  } catch (error) {
    logger.error('Newsletter unsubscribe error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from newsletter',
    })
  }
}

// =====================================================
// Admin Endpoints - Subscribers
// =====================================================

/**
 * Get all subscribers with pagination and filters
 */
export const getSubscribers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      source,
      search,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    if (source) {
      conditions.push(`source = $${paramIndex++}`)
      params.push(source)
    }

    if (search) {
      conditions.push(
        `(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`,
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`)
      params.push(startDate)
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`)
      params.push(endDate)
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const validSortColumns = ['email', 'name', 'status', 'source', 'created_at']
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? sortBy
      : 'created_at'
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM newsletter_subscribers ${whereClause}`,
      params,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get subscribers
    const result = await query(
      `SELECT * FROM newsletter_subscribers 
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, Number(limit), offset],
    )

    res.json({
      success: true,
      data: {
        subscribers: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get newsletter subscribers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get subscribers',
    })
  }
}

/**
 * Get subscriber statistics
 */
export const getSubscriberStats = async (req: AuthRequest, res: Response) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as this_month
      FROM newsletter_subscribers
    `)

    const bySourceResult = await query(`
      SELECT source, COUNT(*) as count
      FROM newsletter_subscribers
      WHERE status = 'active'
      GROUP BY source
    `)

    const growthResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as subscribed,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed
      FROM newsletter_subscribers
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    const stats = statsResult.rows[0]
    const bySource: Record<string, number> = {}
    bySourceResult.rows.forEach((row) => {
      bySource[row.source] = parseInt(row.count)
    })

    res.json({
      success: true,
      data: {
        stats: {
          total: parseInt(stats.total),
          active: parseInt(stats.active),
          unsubscribed: parseInt(stats.unsubscribed),
          bounced: parseInt(stats.bounced),
          today: parseInt(stats.today),
          thisWeek: parseInt(stats.this_week),
          thisMonth: parseInt(stats.this_month),
          bySource,
          growth: growthResult.rows,
        },
      },
    })
  } catch (error) {
    logger.error('Get newsletter stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriber statistics',
    })
  }
}

/**
 * Get subscriber by ID
 */
export const getSubscriberById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'SELECT * FROM newsletter_subscribers WHERE id = $1',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found',
      })
    }

    res.json({
      success: true,
      data: { subscriber: result.rows[0] },
    })
  } catch (error) {
    logger.error('Get subscriber by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriber',
    })
  }
}

/**
 * Update subscriber
 */
export const updateSubscriber = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { email, name, status } = req.body

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (email) {
      updates.push(`email = $${paramIndex++}`)
      params.push(email.toLowerCase())
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      params.push(name)
    }

    if (status) {
      updates.push(`status = $${paramIndex++}`)
      params.push(status)

      if (status === 'unsubscribed') {
        updates.push(`unsubscribed_at = CURRENT_TIMESTAMP`)
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(id)

    const result = await query(
      `UPDATE newsletter_subscribers 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found',
      })
    }

    res.json({
      success: true,
      message: 'Subscriber updated successfully',
      data: { subscriber: result.rows[0] },
    })
  } catch (error) {
    logger.error('Update subscriber error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update subscriber',
    })
  }
}

/**
 * Delete subscriber
 */
export const deleteSubscriber = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found',
      })
    }

    res.json({
      success: true,
      message: 'Subscriber deleted successfully',
    })
  } catch (error) {
    logger.error('Delete subscriber error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscriber',
    })
  }
}

/**
 * Export subscribers as CSV
 */
export const exportSubscribers = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query

    let sqlQuery =
      'SELECT email, name, status, source, created_at FROM newsletter_subscribers'
    const params: any[] = []

    if (status) {
      sqlQuery += ' WHERE status = $1'
      params.push(status)
    }

    sqlQuery += ' ORDER BY created_at DESC'

    const result = await query(sqlQuery, params)

    // Create CSV content
    const headers = ['Email', 'Name', 'Status', 'Source', 'Subscribed At']
    const csvRows = [headers.join(',')]

    result.rows.forEach((row) => {
      const values = [
        `"${row.email}"`,
        `"${row.name || ''}"`,
        row.status,
        row.source,
        row.created_at,
      ]
      csvRows.push(values.join(','))
    })

    const csv = csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=newsletter_subscribers.csv',
    )
    res.send(csv)
  } catch (error) {
    logger.error('Export subscribers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to export subscribers',
    })
  }
}

/**
 * Import subscribers from CSV data
 */
export const importSubscribers = async (req: AuthRequest, res: Response) => {
  try {
    const { subscribers } = req.body

    if (!Array.isArray(subscribers) || subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Subscribers array is required',
      })
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const sub of subscribers) {
      if (!sub.email) {
        skipped++
        continue
      }

      try {
        await query(
          `INSERT INTO newsletter_subscribers (email, name, source, status, confirmed_at)
           VALUES ($1, $2, 'import', 'active', CURRENT_TIMESTAMP)
           ON CONFLICT (email) DO NOTHING`,
          [sub.email.toLowerCase(), sub.name || null],
        )
        imported++
      } catch (err) {
        skipped++
        errors.push(`Failed to import ${sub.email}`)
      }
    }

    res.json({
      success: true,
      message: `Imported ${imported} subscribers, skipped ${skipped}`,
      data: { imported, skipped, errors },
    })
  } catch (error) {
    logger.error('Import subscribers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to import subscribers',
    })
  }
}

// =====================================================
// Admin Endpoints - Campaigns
// =====================================================

/**
 * Get all campaigns with pagination
 */
export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let whereClause = ''
    const params: any[] = []

    if (status) {
      whereClause = 'WHERE status = $1'
      params.push(status)
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM newsletter_campaigns ${whereClause}`,
      params,
    )
    const total = parseInt(countResult.rows[0].count)

    // Get campaigns
    const result = await query(
      `SELECT * FROM newsletter_campaigns 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset],
    )

    res.json({
      success: true,
      data: {
        campaigns: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get campaigns error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get campaigns',
    })
  }
}

/**
 * Get campaign by ID
 */
export const getCampaignById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'SELECT * FROM newsletter_campaigns WHERE id = $1',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    res.json({
      success: true,
      data: { campaign: result.rows[0] },
    })
  } catch (error) {
    logger.error('Get campaign by ID error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign',
    })
  }
}

/**
 * Create a new campaign
 */
export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      subject,
      contentHtml,
      contentText,
      scheduledAt,
      rateLimitPerMinute,
      maxRetries,
      retryBackoffSeconds,
      abTestEnabled,
      subjectA,
      subjectB,
      contentHtmlA,
      contentHtmlB,
      contentTextA,
      contentTextB,
      segmentA,
      segmentB,
    } = req.body

    if (!name || !subject || !contentHtml) {
      return res.status(400).json({
        success: false,
        error: 'name, subject, and contentHtml are required',
      })
    }

    const status = scheduledAt ? 'scheduled' : 'draft'

    const normalizedRateLimit = Math.min(
      Math.max(Number(rateLimitPerMinute) || 60, 1),
      2000,
    )
    const normalizedMaxRetries = Math.min(
      Math.max(Number(maxRetries) || 3, 1),
      10,
    )
    const normalizedRetryBackoffSeconds = Math.min(
      Math.max(Number(retryBackoffSeconds) || 45, 10),
      600,
    )

    const result = await query(
      `INSERT INTO newsletter_campaigns (
          name,
          subject,
          content_html,
          content_text,
          status,
          scheduled_at,
          created_by,
          rate_limit_per_minute,
          max_retries,
           retry_backoff_seconds,
           ab_test_enabled,
           subject_a,
           subject_b,
           content_html_a,
           content_html_b,
           content_text_a,
           content_text_b,
           segment_a,
           segment_b
       )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        name,
        subject,
        contentHtml,
        contentText || null,
        status,
        scheduledAt || null,
        req.user?.id || null,
        normalizedRateLimit,
        normalizedMaxRetries,
        normalizedRetryBackoffSeconds,
        Boolean(abTestEnabled),
        subjectA || null,
        subjectB || null,
        contentHtmlA || null,
        contentHtmlB || null,
        contentTextA || null,
        contentTextB || null,
        segmentA ? JSON.stringify(segmentA) : null,
        segmentB ? JSON.stringify(segmentB) : null,
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: { campaign: result.rows[0] },
    })
  } catch (error) {
    logger.error('Create campaign error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
    })
  }
}

/**
 * Update campaign
 */
export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      name,
      subject,
      contentHtml,
      contentText,
      scheduledAt,
      status,
      rateLimitPerMinute,
      maxRetries,
      retryBackoffSeconds,
      abTestEnabled,
      subjectA,
      subjectB,
      contentHtmlA,
      contentHtmlB,
      contentTextA,
      contentTextB,
      segmentA,
      segmentB,
    } = req.body

    // Check if campaign exists and is editable
    const existing = await query(
      'SELECT status FROM newsletter_campaigns WHERE id = $1',
      [id],
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    if (['sending', 'sent'].includes(existing.rows[0].status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit a campaign that is sending or has been sent',
      })
    }

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (name) {
      updates.push(`name = $${paramIndex++}`)
      params.push(name)
    }

    if (subject) {
      updates.push(`subject = $${paramIndex++}`)
      params.push(subject)
    }

    if (contentHtml) {
      updates.push(`content_html = $${paramIndex++}`)
      params.push(contentHtml)
    }

    if (contentText !== undefined) {
      updates.push(`content_text = $${paramIndex++}`)
      params.push(contentText)
    }

    if (scheduledAt !== undefined) {
      updates.push(`scheduled_at = $${paramIndex++}`)
      params.push(scheduledAt)
    }

    if (status) {
      updates.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    if (rateLimitPerMinute !== undefined) {
      updates.push(`rate_limit_per_minute = $${paramIndex++}`)
      params.push(Math.min(Math.max(Number(rateLimitPerMinute) || 60, 1), 2000))
    }

    if (maxRetries !== undefined) {
      updates.push(`max_retries = $${paramIndex++}`)
      params.push(Math.min(Math.max(Number(maxRetries) || 3, 1), 10))
    }

    if (retryBackoffSeconds !== undefined) {
      updates.push(`retry_backoff_seconds = $${paramIndex++}`)
      params.push(Math.min(Math.max(Number(retryBackoffSeconds) || 45, 10), 600))
    }

    if (abTestEnabled !== undefined) {
      updates.push(`ab_test_enabled = $${paramIndex++}`)
      params.push(Boolean(abTestEnabled))
    }

    if (subjectA !== undefined) {
      updates.push(`subject_a = $${paramIndex++}`)
      params.push(subjectA || null)
    }

    if (subjectB !== undefined) {
      updates.push(`subject_b = $${paramIndex++}`)
      params.push(subjectB || null)
    }

    if (contentHtmlA !== undefined) {
      updates.push(`content_html_a = $${paramIndex++}`)
      params.push(contentHtmlA || null)
    }

    if (contentHtmlB !== undefined) {
      updates.push(`content_html_b = $${paramIndex++}`)
      params.push(contentHtmlB || null)
    }

    if (contentTextA !== undefined) {
      updates.push(`content_text_a = $${paramIndex++}`)
      params.push(contentTextA || null)
    }

    if (contentTextB !== undefined) {
      updates.push(`content_text_b = $${paramIndex++}`)
      params.push(contentTextB || null)
    }

    if (segmentA !== undefined) {
      updates.push(`segment_a = $${paramIndex++}`)
      params.push(segmentA ? JSON.stringify(segmentA) : null)
    }

    if (segmentB !== undefined) {
      updates.push(`segment_b = $${paramIndex++}`)
      params.push(segmentB ? JSON.stringify(segmentB) : null)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(id)

    const result = await query(
      `UPDATE newsletter_campaigns 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    )

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign: result.rows[0] },
    })
  } catch (error) {
    logger.error('Update campaign error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
    })
  }
}

/**
 * Delete campaign
 */
export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if campaign is deletable
    const existing = await query(
      'SELECT status FROM newsletter_campaigns WHERE id = $1',
      [id],
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    if (existing.rows[0].status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a campaign that is currently sending',
      })
    }

    await query('DELETE FROM newsletter_campaigns WHERE id = $1', [id])

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    })
  } catch (error) {
    logger.error('Delete campaign error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
    })
  }
}

/**
 * Send campaign to all active subscribers
 */
export const sendCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Get campaign
    const campaignResult = await query(
      'SELECT * FROM newsletter_campaigns WHERE id = $1',
      [id],
    )

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    const campaign = campaignResult.rows[0]

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        error: 'Campaign cannot be sent in its current status',
      })
    }

    const queueResult = await enqueueCampaign(id)

    res.json({
      success: true,
      message:
        campaign.status === 'scheduled'
          ? `Campaign queued and will send at scheduled time`
          : `Campaign queued and processing has started`,
      data: {
        totalRecipients: queueResult.totalRecipients,
      },
    })
  } catch (error) {
    logger.error('Send campaign error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send campaign',
    })
  }
}

/**
 * Get campaign statistics
 */
export const getCampaignStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const campaign = await query(
      'SELECT * FROM newsletter_campaigns WHERE id = $1',
      [id],
    )

    if (campaign.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    const recipientStats = await query(
      `
      SELECT 
        status,
        COUNT(*) as count
      FROM newsletter_campaign_recipients
      WHERE campaign_id = $1
      GROUP BY status
    `,
      [id],
    )

    const stats: Record<string, number> = {
      pending: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
    }

    recipientStats.rows.forEach((row) => {
      stats[row.status] = parseInt(row.count)
    })

    const conversionsSummary = await query(
      `SELECT
         COUNT(DISTINCT order_id)::int AS orders,
         COALESCE(SUM(order_total), 0)::decimal AS revenue
       FROM newsletter_conversion_events
       WHERE campaign_id = $1`,
      [id],
    )

    res.json({
      success: true,
      data: {
        campaign: campaign.rows[0],
        stats,
        conversions: {
          orders: Number(conversionsSummary.rows[0]?.orders || 0),
          revenue: Number(conversionsSummary.rows[0]?.revenue || 0),
        },
      },
    })
  } catch (error) {
    logger.error('Get campaign stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign statistics',
    })
  }
}

async function syncCampaignConversions(campaignId: string): Promise<void> {
  await query(
    `INSERT INTO newsletter_conversion_events
      (campaign_id, link_event_id, order_id, recipient_email, product_slug, order_total)
     SELECT
       le.campaign_id,
       le.id,
       o.id,
       le.recipient_email,
       le.product_slug,
       o.grand_total
     FROM newsletter_link_events le
     JOIN orders o
       ON o.created_at >= le.clicked_at
      AND o.created_at <= le.clicked_at + INTERVAL '14 days'
     LEFT JOIN users u ON u.id = o.user_id
     WHERE le.campaign_id = $1
       AND le.clicked_at IS NOT NULL
       AND LOWER(COALESCE(u.email, o.shipping_address->>'email', '')) = LOWER(le.recipient_email)
       AND (
         le.product_slug IS NULL OR EXISTS (
           SELECT 1
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = o.id
             AND LOWER(p.slug) = LOWER(le.product_slug)
         )
       )
     ON CONFLICT (campaign_id, link_event_id, order_id) DO NOTHING`,
    [campaignId],
  )
}

export const getCampaignConversions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const campaign = await query(
      `SELECT id, name, subject, ab_test_enabled, ab_winner_variant, ab_rollout_at
       FROM newsletter_campaigns
       WHERE id = $1`,
      [id],
    )

    if (campaign.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      })
    }

    await syncCampaignConversions(id)

    const [summaryResult, byProductResult, byVariantResult] = await Promise.all([
      query(
        `SELECT
           COUNT(DISTINCT order_id)::int AS orders,
           COALESCE(SUM(order_total), 0)::decimal AS revenue,
           COUNT(*)::int AS attributed_events
         FROM newsletter_conversion_events
         WHERE campaign_id = $1`,
        [id],
      ),
      query(
        `SELECT
           COALESCE(product_slug, 'unknown') AS product_slug,
           COUNT(DISTINCT order_id)::int AS orders,
           COALESCE(SUM(order_total), 0)::decimal AS revenue
         FROM newsletter_conversion_events
         WHERE campaign_id = $1
         GROUP BY COALESCE(product_slug, 'unknown')
         ORDER BY revenue DESC, orders DESC
         LIMIT 20`,
        [id],
      ),
      query(
        `SELECT
           le.variant_key,
           COUNT(DISTINCT nce.order_id)::int AS orders,
           COALESCE(SUM(nce.order_total), 0)::decimal AS revenue
         FROM newsletter_link_events le
         LEFT JOIN newsletter_conversion_events nce
           ON nce.link_event_id = le.id
         WHERE le.campaign_id = $1
         GROUP BY le.variant_key
         ORDER BY le.variant_key ASC`,
        [id],
      ),
    ])

    res.json({
      success: true,
      data: {
        campaign: campaign.rows[0],
        summary: {
          orders: Number(summaryResult.rows[0]?.orders || 0),
          revenue: Number(summaryResult.rows[0]?.revenue || 0),
          attributedEvents: Number(summaryResult.rows[0]?.attributed_events || 0),
        },
        byProduct: byProductResult.rows.map((row) => ({
          productSlug: row.product_slug,
          orders: Number(row.orders || 0),
          revenue: Number(row.revenue || 0),
        })),
        byVariant: byVariantResult.rows.map((row) => ({
          variant: row.variant_key,
          orders: Number(row.orders || 0),
          revenue: Number(row.revenue || 0),
        })),
      },
    })
  } catch (error) {
    logger.error('Get campaign conversions error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign conversions',
    })
  }
}

export const trackClickRedirect = async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const eventResult = await query(
      `UPDATE newsletter_link_events
       SET clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
           click_count = click_count + 1,
           clicked_ip = $2,
           clicked_user_agent = $3
       WHERE token = $1::uuid
       RETURNING id, campaign_id, recipient_id, destination_url`,
      [token, req.ip || null, req.headers['user-agent'] || null],
    )

    if (eventResult.rows.length === 0) {
      return res.redirect('https://techtoolstore.com/')
    }

    const event = eventResult.rows[0]

    await query(
      `UPDATE newsletter_campaign_recipients
       SET status = CASE
             WHEN status IN ('sent', 'delivered', 'opened') THEN 'clicked'
             ELSE status
           END,
           clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [event.recipient_id],
    )

    await query(
      `UPDATE newsletter_campaigns
       SET clicked_count = (
            SELECT COUNT(DISTINCT recipient_id)
            FROM newsletter_link_events
            WHERE campaign_id = $1
              AND clicked_at IS NOT NULL
          ),
          updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [event.campaign_id],
    )

    return res.redirect(event.destination_url)
  } catch (error) {
    logger.error('Track click redirect error:', error)
    return res.redirect('https://techtoolstore.com/')
  }
}

// =====================================================
// Deliverability
// =====================================================

function getDomainFromEmail(email: string): string {
  const parts = String(email || '').toLowerCase().split('@')
  return parts.length === 2 ? parts[1] : ''
}

async function resolveTxtSafe(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname)
    return records.map((chunk) => chunk.join('')).filter(Boolean)
  } catch {
    return []
  }
}

export const getDeliverabilityDashboard = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const fromDomain = getDomainFromEmail(
      process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || '',
    )

    const [totalsResult, complaintsResult, domainStatsResult, abResults] =
      await Promise.all([
        query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
             COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
             COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
           FROM email_messages
           WHERE created_at >= NOW() - INTERVAL '30 days'`,
        ),
        query(
          `SELECT COUNT(*)::int AS complaints
           FROM email_complaints
           WHERE created_at >= NOW() - INTERVAL '30 days'`,
        ),
        query(
          `SELECT
             split_part(lower(recipient_email), '@', 2) AS domain,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('sent', 'delivered'))::int AS sent,
             COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
           FROM email_messages
           WHERE created_at >= NOW() - INTERVAL '30 days'
           GROUP BY split_part(lower(recipient_email), '@', 2)
           ORDER BY total DESC
           LIMIT 8`,
        ),
        query(
          `SELECT
             variant_key,
             COUNT(*)::int AS recipients,
             COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
             COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
             COUNT(*) FILTER (WHERE status = 'opened')::int AS opened,
             COUNT(*) FILTER (WHERE status = 'clicked')::int AS clicked
           FROM newsletter_campaign_recipients
           WHERE created_at >= NOW() - INTERVAL '30 days'
           GROUP BY variant_key
           ORDER BY variant_key ASC`,
        ),
      ])

    const totals = totalsResult.rows[0] || {
      total: 0,
      sent: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
    }
    const complaints = Number(complaintsResult.rows[0]?.complaints || 0)
    const total = Number(totals.total || 0)
    const bounced = Number(totals.bounced || 0)
    const failed = Number(totals.failed || 0)

    const bounceRate = total > 0 ? (bounced / total) * 100 : 0
    const complaintRate = total > 0 ? (complaints / total) * 100 : 0

    const spfRecords = fromDomain
      ? await resolveTxtSafe(fromDomain)
      : []
    const dmarcRecords = fromDomain
      ? await resolveTxtSafe(`_dmarc.${fromDomain}`)
      : []
    const dkimRecords = fromDomain
      ? await resolveTxtSafe(`default._domainkey.${fromDomain}`)
      : []

    const hasSpf = spfRecords.some((record) => /v=spf1/i.test(record))
    const hasDmarc = dmarcRecords.some((record) => /v=dmarc1/i.test(record))
    const hasDkim = dkimRecords.some((record) => /v=dkim1|k=rsa/i.test(record))

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 - bounceRate * 7 - complaintRate * 14 +
            (hasSpf ? 8 : -12) +
            (hasDkim ? 8 : -10) +
            (hasDmarc ? 8 : -8),
        ),
      ),
    )

    const healthLabel =
      healthScore >= 80 ? 'healthy' : healthScore >= 55 ? 'warning' : 'critical'

    res.json({
      success: true,
      data: {
        dashboard: {
          window: '30d',
          totals: {
            total,
            sent: Number(totals.sent || 0),
            delivered: Number(totals.delivered || 0),
            bounced,
            failed,
            complaints,
            bounceRate,
            complaintRate,
          },
          domainHealth: {
            fromDomain,
            score: healthScore,
            label: healthLabel,
            checks: {
              spf: hasSpf,
              dkim: hasDkim,
              dmarc: hasDmarc,
            },
          },
          domains: domainStatsResult.rows,
          abPerformance: abResults.rows,
        },
      },
    })
  } catch (error) {
    logger.error('Get deliverability dashboard error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get deliverability dashboard',
    })
  }
}

export const recordComplaint = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientEmail, campaignId, provider, reason, metadata } = req.body

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'recipientEmail is required',
      })
    }

    await query(
      `INSERT INTO email_complaints
        (recipient_email, campaign_id, provider, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        String(recipientEmail).toLowerCase(),
        campaignId || null,
        provider || null,
        reason || null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    )

    res.status(201).json({
      success: true,
      message: 'Complaint recorded',
    })
  } catch (error) {
    logger.error('Record complaint error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to record complaint',
    })
  }
}

// =====================================================
// Settings
// =====================================================

/**
 * Get newsletter settings
 */
export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT setting_key, setting_value, description FROM newsletter_settings ORDER BY setting_key',
    )

    const settings: Record<string, { value: string; description: string }> = {}
    result.rows.forEach((row) => {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
      }
    })

    res.json({
      success: true,
      data: { settings },
    })
  } catch (error) {
    logger.error('Get newsletter settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    })
  }
}

/**
 * Update newsletter settings
 */
export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings object is required',
      })
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO newsletter_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)],
      )
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    logger.error('Update newsletter settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    })
  }
}
