import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import emailService from '../../../services/email.service'
import logger from '../../../utils/logger'

// =====================================================
// Email Message Management
// =====================================================

/**
 * Get all email messages with pagination and filters
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      emailType,
      search,
      startDate,
      endDate,
    } = req.query

    const result = await emailService.getMessages({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      emailType: emailType as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    })

    res.json({
      success: true,
      data: {
        messages: result.messages,
        pagination: {
          page: result.page,
          limit: Number(limit),
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    })
  } catch (error) {
    logger.error('Get email messages error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get email messages',
    })
  }
}

/**
 * Get email message statistics
 */
export const getMessageStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await emailService.getStats()

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error) {
    logger.error('Get email stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get email statistics',
    })
  }
}

/**
 * Send a custom email
 */
export const sendEmail = async (req: AuthRequest, res: Response) => {
  try {
    const {
      to,
      toName,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
      orderId,
      emailType,
      fromAlias,
    } = req.body

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: 'to, subject, and html are required',
      })
    }

    const result = await emailService.sendEmail({
      to,
      toName,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
      orderId,
      emailType: emailType || 'custom',
      fromAlias,
    })

    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        data: { messageId: result.messageId },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send email',
      })
    }
  } catch (error) {
    logger.error('Send email error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
    })
  }
}

/**
 * Resend a failed email
 */
export const resendEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await emailService.resendEmail(id)

    if (result.success) {
      res.json({
        success: true,
        message: 'Email resent successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to resend email',
      })
    }
  } catch (error) {
    logger.error('Resend email error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to resend email',
    })
  }
}

/**
 * Get configuration status
 */
export const getConfigStatus = async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        isConfigured: emailService.isConfigured(),
        provider: 'smtp',
      },
    })
  } catch (error) {
    logger.error('Get email config status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration status',
    })
  }
}

// =====================================================
// Email Settings Management
// =====================================================

/**
 * Get email settings
 */
export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await emailService.getSettings()

    res.json({
      success: true,
      data: {
        settings,
        isConfigured: emailService.isConfigured(),
      },
    })
  } catch (error) {
    logger.error('Get email settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    })
  }
}

/**
 * Update email settings
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

    const result = await emailService.updateSettings(settings)

    if (result.success) {
      res.json({
        success: true,
        message: 'Settings updated successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update settings',
      })
    }
  } catch (error) {
    logger.error('Update email settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    })
  }
}

// =====================================================
// Email Aliases Management
// =====================================================

/**
 * Get all email aliases
 */
export const getAliases = async (req: AuthRequest, res: Response) => {
  try {
    const aliases = await emailService.getAliases()

    res.json({
      success: true,
      data: { aliases },
    })
  } catch (error) {
    logger.error('Get email aliases error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get aliases',
    })
  }
}

/**
 * Create an email alias
 */
export const createAlias = async (req: AuthRequest, res: Response) => {
  try {
    const {
      aliasEmail,
      aliasName,
      purpose,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      isDefault,
    } = req.body

    if (!aliasEmail || !aliasName || !purpose) {
      return res.status(400).json({
        success: false,
        error: 'aliasEmail, aliasName, and purpose are required',
      })
    }

    const result = await emailService.createAlias({
      aliasEmail,
      aliasName,
      purpose,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      isDefault,
    })

    if (result.success) {
      res.status(201).json({
        success: true,
        data: { alias: result.alias },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create alias',
      })
    }
  } catch (error) {
    logger.error('Create email alias error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create alias',
    })
  }
}

/**
 * Update an email alias
 */
export const updateAlias = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      aliasName,
      purpose,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      isActive,
      isDefault,
    } = req.body

    const result = await emailService.updateAlias(id, {
      aliasName,
      purpose,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      isActive,
      isDefault,
    })

    if (result.success) {
      res.json({
        success: true,
        data: { alias: result.alias },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update alias',
      })
    }
  } catch (error) {
    logger.error('Update email alias error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update alias',
    })
  }
}

/**
 * Delete an email alias
 */
export const deleteAlias = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await emailService.deleteAlias(id)

    if (result.success) {
      res.json({
        success: true,
        message: 'Alias deleted successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to delete alias',
      })
    }
  } catch (error) {
    logger.error('Delete email alias error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete alias',
    })
  }
}

/**
 * Test an email alias
 */
export const testAlias = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { testEmail } = req.body

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'testEmail is required',
      })
    }

    const result = await emailService.testAlias(id, testEmail)

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test email',
      })
    }
  } catch (error) {
    logger.error('Test email alias error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test alias',
    })
  }
}

// =====================================================
// Email Templates Management
// =====================================================

/**
 * Get all templates
 */
export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const templates = await emailService.getTemplates()

    res.json({
      success: true,
      data: { templates },
    })
  } catch (error) {
    logger.error('Get email templates error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get templates',
    })
  }
}

/**
 * Create a new template
 */
export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { name, templateKey, subject, bodyHtml, bodyText, variables } =
      req.body

    if (!name || !templateKey || !subject || !bodyHtml) {
      return res.status(400).json({
        success: false,
        error: 'name, templateKey, subject, and bodyHtml are required',
      })
    }

    const result = await emailService.createTemplate({
      name,
      templateKey,
      subject,
      bodyHtml,
      bodyText,
      variables,
    })

    if (result.success) {
      res.status(201).json({
        success: true,
        data: { template: result.template },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create template',
      })
    }
  } catch (error) {
    logger.error('Create email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
    })
  }
}

/**
 * Update a template
 */
export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, subject, bodyHtml, bodyText, variables, isActive } = req.body

    const result = await emailService.updateTemplate(id, {
      name,
      subject,
      bodyHtml,
      bodyText,
      variables,
      isActive,
    })

    if (result.success) {
      res.json({
        success: true,
        data: { template: result.template },
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update template',
      })
    }
  } catch (error) {
    logger.error('Update email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
    })
  }
}

/**
 * Delete a template
 */
export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await emailService.deleteTemplate(id)

    if (result.success) {
      res.json({
        success: true,
        message: 'Template deleted successfully',
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to delete template',
      })
    }
  } catch (error) {
    logger.error('Delete email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    })
  }
}
