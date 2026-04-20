import { Request, Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import emailService from '../../../services/email.service'
import NotificationEvents from '../../../services/notification.events'
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

      await emailService.sendAdminNotification({
        subject: `Newsletter reactivation: ${email.toLowerCase()}`,
        html: buildNewsletterAdminAlertHtml({
          email: email.toLowerCase(),
          name: name || null,
          source,
          event: 'resubscribed',
        }),
        emailType: 'custom',
      })

      await NotificationEvents.onNewsletterSubscription({
        email: email.toLowerCase(),
        name: name || null,
        source,
        event: 'resubscribed',
        subscriberId: subscriber.id,
      })

      return res.json({
        success: true,
        message: 'Welcome back! You have been resubscribed to our newsletter.',
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

    await emailService.sendAdminNotification({
      subject: `New newsletter subscriber: ${email.toLowerCase()}`,
      html: buildNewsletterAdminAlertHtml({
        email: email.toLowerCase(),
        name: name || null,
        source,
        event: 'subscribed',
      }),
      emailType: 'custom',
    })

    await NotificationEvents.onNewsletterSubscription({
      email: email.toLowerCase(),
      name: name || null,
      source,
      event: 'subscribed',
      subscriberId: result.rows[0].id,
    })

    // Send welcome email if enabled
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
        await emailService.sendEmail({
          to: email,
          toName: name || undefined,
          subject: settings.welcome_subject || 'Welcome to our Newsletter!',
          html: settings.welcome_message || '<p>Thank you for subscribing!</p>',
          emailType: 'promotional',
        })
      }
    } catch (emailError) {
      logger.warn('Failed to send welcome email:', emailError)
      // Don't fail the subscription if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing! Check your email for 10% off.',
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
    const { name, subject, contentHtml, contentText, scheduledAt } = req.body

    if (!name || !subject || !contentHtml) {
      return res.status(400).json({
        success: false,
        error: 'name, subject, and contentHtml are required',
      })
    }

    const status = scheduledAt ? 'scheduled' : 'draft'

    const result = await query(
      `INSERT INTO newsletter_campaigns (name, subject, content_html, content_text, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        subject,
        contentHtml,
        contentText || null,
        status,
        scheduledAt || null,
        req.user?.id || null,
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
    const { name, subject, contentHtml, contentText, scheduledAt, status } =
      req.body

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

    // Get active subscribers
    const subscribersResult = await query(
      `SELECT id, email, name FROM newsletter_subscribers WHERE status = 'active'`,
    )

    if (subscribersResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active subscribers to send to',
      })
    }

    // Update campaign status
    await query(
      `UPDATE newsletter_campaigns 
       SET status = 'sending', 
           total_recipients = $2,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id, subscribersResult.rows.length],
    )

    // Get settings for from email
    const settingsResult = await query(
      `SELECT setting_key, setting_value FROM newsletter_settings 
       WHERE setting_key IN ('from_name', 'from_email')`,
    )

    const settings: Record<string, string> = {}
    settingsResult.rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value
    })

    // Send emails asynchronously
    let sentCount = 0
    let failedCount = 0

    // Process in background (in production, use a queue)
    setImmediate(async () => {
      for (const subscriber of subscribersResult.rows) {
        try {
          // Create recipient record
          await query(
            `INSERT INTO newsletter_campaign_recipients (campaign_id, subscriber_id, email, status)
             VALUES ($1, $2, $3, 'pending')
             ON CONFLICT (campaign_id, subscriber_id) DO NOTHING`,
            [id, subscriber.id, subscriber.email],
          )

          // Send email
          const result = await emailService.sendEmail({
            to: subscriber.email,
            toName: subscriber.name || undefined,
            subject: campaign.subject,
            html: campaign.content_html,
            text: campaign.content_text,
            emailType: 'promotional',
          })

          if (result.success) {
            sentCount++
            await query(
              `UPDATE newsletter_campaign_recipients 
               SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
               WHERE campaign_id = $1 AND subscriber_id = $2`,
              [id, subscriber.id],
            )
          } else {
            failedCount++
            await query(
              `UPDATE newsletter_campaign_recipients 
               SET status = 'bounced' 
               WHERE campaign_id = $1 AND subscriber_id = $2`,
              [id, subscriber.id],
            )
          }
        } catch (err) {
          failedCount++
          logger.error(`Failed to send to ${subscriber.email}:`, err)
        }
      }

      // Update campaign as sent
      await query(
        `UPDATE newsletter_campaigns 
         SET status = 'sent', 
             sent_at = CURRENT_TIMESTAMP,
             sent_count = $2,
             bounced_count = $3,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id, sentCount, failedCount],
      )

      logger.info(
        `Campaign ${id} completed: ${sentCount} sent, ${failedCount} failed`,
      )
    })

    res.json({
      success: true,
      message: `Campaign is being sent to ${subscribersResult.rows.length} subscribers`,
      data: {
        totalRecipients: subscribersResult.rows.length,
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

    res.json({
      success: true,
      data: {
        campaign: campaign.rows[0],
        stats,
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
