import nodemailer from 'nodemailer'
import logger from '../utils/logger'
import { query } from '../database/connection'

// ============================================
// Email Configuration Types
// ============================================

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  cc?: string
  bcc?: string
  orderId?: string
  emailType?: string
  fromAlias?: string // Use specific alias
}

export interface EmailMessage {
  id: string
  order_id?: string
  recipient_email: string
  recipient_name?: string
  email_type: string
  subject: string
  body_html?: string
  body_text?: string
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed'
  smtp_message_id?: string
  error_message?: string
  from_email?: string
  from_name?: string
  reply_to?: string
  cc?: string
  bcc?: string
  sent_at?: string
  opened_at?: string
  clicked_at?: string
  created_at: string
  updated_at: string
}

export interface EmailFilters {
  page?: number
  limit?: number
  status?: string
  emailType?: string
  search?: string
  startDate?: string
  endDate?: string
}

// Company info for email templates
const COMPANY_NAME = process.env.EMAIL_FROM_NAME || 'TechTools Store'
const COMPANY_EMAIL = process.env.SMTP_USER || 'noreply@techtoolstore.com'
const COMPANY_WEBSITE = process.env.FRONTEND_URL || 'https://techtoolstore.com'

// ============================================
// Email Service Class
// ============================================

class EmailService {
  private defaultConfig: EmailConfig | null = null

  constructor() {
    this.loadConfig()
  }

  private loadConfig() {
    this.defaultConfig = {
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || '',
      fromName: process.env.EMAIL_FROM_NAME || COMPANY_NAME,
    }
  }

  /**
   * Check if email is properly configured
   */
  isConfigured(): boolean {
    return !!(this.defaultConfig?.user && this.defaultConfig?.pass)
  }

  /**
   * Create transporter for sending emails
   */
  private createTransporter(config?: Partial<EmailConfig>) {
    const useConfig = { ...this.defaultConfig, ...config }

    return nodemailer.createTransport({
      host: useConfig.host,
      port: useConfig.port,
      secure: useConfig.secure,
      auth: {
        user: useConfig.user,
        pass: useConfig.pass,
      },
    })
  }

  /**
   * Send an email and log it to database
   */
  async sendEmail(
    options: SendEmailOptions,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Create pending log entry
    let logId: string | null = null

    try {
      // Log to database first
      const logResult = await query(
        `INSERT INTO email_messages 
         (recipient_email, recipient_name, subject, body_html, body_text, email_type, order_id, from_email, from_name, reply_to, cc, bcc, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
         RETURNING id`,
        [
          options.to,
          options.toName || null,
          options.subject,
          options.html,
          options.text || null,
          options.emailType || 'custom',
          options.orderId || null,
          this.defaultConfig?.fromEmail,
          this.defaultConfig?.fromName,
          options.replyTo || null,
          options.cc || null,
          options.bcc || null,
        ],
      )

      logId = logResult.rows[0]?.id

      // Check if email is configured
      if (!this.isConfigured()) {
        logger.warn('SMTP not configured. Email logged but not sent:', {
          to: options.to,
          subject: options.subject,
        })

        if (logId) {
          await query(
            `UPDATE email_messages SET status = 'failed', error_message = 'SMTP not configured' WHERE id = $1`,
            [logId],
          )
        }

        return { success: false, error: 'SMTP not configured' }
      }

      // Get alias config if specified
      let aliasConfig: Partial<EmailConfig> | undefined
      let fromEmail = this.defaultConfig?.fromEmail
      let fromName = this.defaultConfig?.fromName

      if (options.fromAlias) {
        const aliasResult = await query(
          `SELECT * FROM email_aliases WHERE alias_email = $1 AND is_active = true`,
          [options.fromAlias],
        )

        if (aliasResult.rows.length > 0) {
          const alias = aliasResult.rows[0]
          aliasConfig = {
            host: alias.smtp_host || this.defaultConfig?.host,
            port: alias.smtp_port || this.defaultConfig?.port,
            secure: alias.smtp_secure ?? this.defaultConfig?.secure,
            user: alias.smtp_user || this.defaultConfig?.user,
            pass: alias.smtp_pass_encrypted || this.defaultConfig?.pass, // TODO: Decrypt
          }
          fromEmail = alias.alias_email
          fromName = alias.alias_name
        }
      }

      // Create transporter and send
      const transporter = this.createTransporter(aliasConfig)

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      }

      const info = await transporter.sendMail(mailOptions)

      // Update log with success
      if (logId) {
        await query(
          `UPDATE email_messages 
           SET status = 'sent', smtp_message_id = $1, sent_at = NOW(), from_email = $2, from_name = $3
           WHERE id = $4`,
          [info.messageId, fromEmail, fromName, logId],
        )
      }

      logger.info('Email sent successfully:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      })

      return { success: true, messageId: info.messageId }
    } catch (error: any) {
      logger.error('Failed to send email:', {
        to: options.to,
        subject: options.subject,
        error: error.message,
      })

      // Update log with failure
      if (logId) {
        await query(
          `UPDATE email_messages SET status = 'failed', error_message = $1 WHERE id = $2`,
          [error.message, logId],
        )
      }

      return { success: false, error: error.message }
    }
  }

  /**
   * Get emails with filters
   */
  async getMessages(filters: EmailFilters): Promise<{
    messages: EmailMessage[]
    page: number
    total: number
    totalPages: number
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      emailType,
      search,
      startDate,
      endDate,
    } = filters
    const offset = (page - 1) * limit

    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    if (emailType) {
      whereClause += ` AND email_type = $${paramIndex++}`
      params.push(emailType)
    }

    if (search) {
      whereClause += ` AND (recipient_email ILIKE $${paramIndex} OR subject ILIKE $${paramIndex} OR recipient_name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex++}`
      params.push(endDate)
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM email_messages ${whereClause}`,
      params,
    )
    const total = parseInt(countResult.rows[0].total)

    // Get messages with joined order info
    const messagesResult = await query(
      `SELECT 
        em.*,
        o.order_number,
        o.shipping_address->>'first_name' as order_first_name,
        o.shipping_address->>'last_name' as order_last_name
      FROM email_messages em
      LEFT JOIN orders o ON em.order_id::text = o.id::text OR em.order_id = o.order_number
      ${whereClause}
      ORDER BY em.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    )

    return {
      messages: messagesResult.rows,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<{
    total: number
    sent: number
    delivered: number
    bounced: number
    failed: number
    todayCount: number
    weekCount: number
    byType: Record<string, number>
  }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_count
      FROM email_messages
    `)

    const typeResult = await query(`
      SELECT email_type, COUNT(*) as count
      FROM email_messages
      GROUP BY email_type
    `)

    const byType: Record<string, number> = {}
    typeResult.rows.forEach((row: any) => {
      byType[row.email_type] = parseInt(row.count)
    })

    const stats = result.rows[0]

    return {
      total: parseInt(stats.total),
      sent: parseInt(stats.sent),
      delivered: parseInt(stats.delivered),
      bounced: parseInt(stats.bounced),
      failed: parseInt(stats.failed),
      todayCount: parseInt(stats.today_count),
      weekCount: parseInt(stats.week_count),
      byType,
    }
  }

  /**
   * Resend a failed email
   */
  async resendEmail(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await query('SELECT * FROM email_messages WHERE id = $1', [
      id,
    ])

    if (result.rows.length === 0) {
      return { success: false, error: 'Email not found' }
    }

    const email = result.rows[0]

    // Create new send attempt
    const sendResult = await this.sendEmail({
      to: email.recipient_email,
      toName: email.recipient_name,
      subject: email.subject,
      html: email.body_html,
      text: email.body_text,
      emailType: email.email_type,
      orderId: email.order_id,
      replyTo: email.reply_to,
      cc: email.cc,
      bcc: email.bcc,
    })

    return sendResult
  }

  // ============================================
  // Email Aliases Management
  // ============================================

  /**
   * Get all email aliases
   */
  async getAliases(): Promise<any[]> {
    const result = await query(
      `SELECT id, alias_email, alias_name, purpose, smtp_host, smtp_port, smtp_secure, smtp_user, is_active, is_default, created_at
       FROM email_aliases 
       ORDER BY is_default DESC, created_at DESC`,
    )
    return result.rows
  }

  /**
   * Create an email alias
   */
  async createAlias(data: {
    aliasEmail: string
    aliasName: string
    purpose: string
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUser?: string
    smtpPass?: string
    isDefault?: boolean
  }): Promise<{ success: boolean; alias?: any; error?: string }> {
    try {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await query('UPDATE email_aliases SET is_default = false')
      }

      const result = await query(
        `INSERT INTO email_aliases 
         (alias_email, alias_name, purpose, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.aliasEmail,
          data.aliasName,
          data.purpose,
          data.smtpHost || process.env.SMTP_HOST,
          data.smtpPort || parseInt(process.env.SMTP_PORT || '465'),
          data.smtpSecure ?? true,
          data.smtpUser,
          data.smtpPass, // TODO: Encrypt
          data.isDefault || false,
        ],
      )

      return { success: true, alias: result.rows[0] }
    } catch (error: any) {
      if (error.code === '23505') {
        return { success: false, error: 'Email alias already exists' }
      }
      return { success: false, error: error.message }
    }
  }

  /**
   * Update an email alias
   */
  async updateAlias(
    id: string,
    data: Partial<{
      aliasName: string
      purpose: string
      smtpHost: string
      smtpPort: number
      smtpSecure: boolean
      smtpUser: string
      smtpPass: string
      isActive: boolean
      isDefault: boolean
    }>,
  ): Promise<{ success: boolean; alias?: any; error?: string }> {
    try {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await query(
          'UPDATE email_aliases SET is_default = false WHERE id != $1',
          [id],
        )
      }

      const result = await query(
        `UPDATE email_aliases SET
         alias_name = COALESCE($1, alias_name),
         purpose = COALESCE($2, purpose),
         smtp_host = COALESCE($3, smtp_host),
         smtp_port = COALESCE($4, smtp_port),
         smtp_secure = COALESCE($5, smtp_secure),
         smtp_user = COALESCE($6, smtp_user),
         smtp_pass_encrypted = COALESCE($7, smtp_pass_encrypted),
         is_active = COALESCE($8, is_active),
         is_default = COALESCE($9, is_default),
         updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          data.aliasName,
          data.purpose,
          data.smtpHost,
          data.smtpPort,
          data.smtpSecure,
          data.smtpUser,
          data.smtpPass, // TODO: Encrypt
          data.isActive,
          data.isDefault,
          id,
        ],
      )

      if (result.rows.length === 0) {
        return { success: false, error: 'Alias not found' }
      }

      return { success: true, alias: result.rows[0] }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete an email alias
   */
  async deleteAlias(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await query(
      'DELETE FROM email_aliases WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return { success: false, error: 'Alias not found' }
    }

    return { success: true }
  }

  /**
   * Test an email alias configuration
   */
  async testAlias(
    id: string,
    testEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const aliasResult = await query(
      'SELECT * FROM email_aliases WHERE id = $1',
      [id],
    )

    if (aliasResult.rows.length === 0) {
      return { success: false, error: 'Alias not found' }
    }

    const alias = aliasResult.rows[0]

    try {
      const transporter = nodemailer.createTransport({
        host: alias.smtp_host || this.defaultConfig?.host,
        port: alias.smtp_port || this.defaultConfig?.port,
        secure: alias.smtp_secure ?? this.defaultConfig?.secure,
        auth: {
          user: alias.smtp_user || this.defaultConfig?.user,
          pass: alias.smtp_pass_encrypted || this.defaultConfig?.pass,
        },
      })

      await transporter.sendMail({
        from: `"${alias.alias_name}" <${alias.alias_email}>`,
        to: testEmail,
        subject: 'TechTools - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #f97316;">Email Configuration Test</h2>
            <p>This is a test email from <strong>${
              alias.alias_name
            }</strong> (${alias.alias_email})</p>
            <p>If you received this email, your email alias is configured correctly!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              Purpose: ${alias.purpose}<br>
              SMTP Host: ${alias.smtp_host}<br>
              SMTP Port: ${alias.smtp_port}<br>
              Secure: ${alias.smtp_secure ? 'Yes' : 'No'}
            </p>
          </div>
        `,
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // ============================================
  // Email Templates Management
  // ============================================

  /**
   * Get all email templates
   */
  async getTemplates(): Promise<any[]> {
    const result = await query('SELECT * FROM email_templates ORDER BY name')
    return result.rows
  }

  /**
   * Create an email template
   */
  async createTemplate(data: {
    name: string
    templateKey: string
    subject: string
    bodyHtml: string
    bodyText?: string
    variables?: string[]
  }): Promise<{ success: boolean; template?: any; error?: string }> {
    try {
      const result = await query(
        `INSERT INTO email_templates (name, template_key, subject, body_html, body_text, variables)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.name,
          data.templateKey,
          data.subject,
          data.bodyHtml,
          data.bodyText || null,
          JSON.stringify(data.variables || []),
        ],
      )

      return { success: true, template: result.rows[0] }
    } catch (error: any) {
      if (error.code === '23505') {
        return { success: false, error: 'Template key already exists' }
      }
      return { success: false, error: error.message }
    }
  }

  /**
   * Update an email template
   */
  async updateTemplate(
    id: string,
    data: Partial<{
      name: string
      subject: string
      bodyHtml: string
      bodyText: string
      variables: string[]
      isActive: boolean
    }>,
  ): Promise<{ success: boolean; template?: any; error?: string }> {
    try {
      const result = await query(
        `UPDATE email_templates SET
         name = COALESCE($1, name),
         subject = COALESCE($2, subject),
         body_html = COALESCE($3, body_html),
         body_text = COALESCE($4, body_text),
         variables = COALESCE($5, variables),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          data.name,
          data.subject,
          data.bodyHtml,
          data.bodyText,
          data.variables ? JSON.stringify(data.variables) : null,
          data.isActive,
          id,
        ],
      )

      if (result.rows.length === 0) {
        return { success: false, error: 'Template not found' }
      }

      return { success: true, template: result.rows[0] }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await query(
      'DELETE FROM email_templates WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return { success: false, error: 'Template not found' }
    }

    return { success: true }
  }

  // ============================================
  // Settings Management
  // ============================================

  /**
   * Get email settings
   */
  async getSettings(): Promise<
    Record<string, { value: string; description: string; isEncrypted: boolean }>
  > {
    const result = await query(
      'SELECT * FROM email_settings ORDER BY setting_key',
    )

    const settings: Record<string, any> = {}
    result.rows.forEach((row: any) => {
      settings[row.setting_key] = {
        value: row.is_encrypted ? '********' : row.setting_value,
        description: row.description,
        isEncrypted: row.is_encrypted,
      }
    })

    return settings
  }

  /**
   * Update email settings
   */
  async updateSettings(
    settings: Record<string, string>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        await query(
          `UPDATE email_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2`,
          [value, key],
        )
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
const emailService = new EmailService()
export default emailService
