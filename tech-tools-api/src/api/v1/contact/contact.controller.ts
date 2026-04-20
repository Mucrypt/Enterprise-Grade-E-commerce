import { Request, Response } from 'express'
import logger from '../../../utils/logger'
import { query } from '../../../database/connection'
import type { AuthRequest } from '../../../middleware/auth'
import emailService from '../../../services/email.service'

// Contact form submission types
interface ContactFormData {
  name: string
  email: string
  phone?: string
  subject: string
  orderNumber?: string
  message: string
}

interface ReplySubmissionData {
  body: string
  subject?: string
}

// Subject to department email mapping
const subjectEmailMap: Record<string, string> = {
  order: 'orders@techtoolstore.com',
  shipping: 'orders@techtoolstore.com',
  return: 'returns@techtoolstore.com',
  billing: 'billing@techtoolstore.com',
  product: 'support@techtoolstore.com',
  technical: 'support@techtoolstore.com',
  feedback: 'support@techtoolstore.com',
  other: 'support@techtoolstore.com',
}

// Get the recipient email based on subject
const getRecipientEmail = (subject: string): string => {
  return subjectEmailMap[subject] || 'support@techtoolstore.com'
}

// Subject label mapping
const subjectLabels: Record<string, string> = {
  order: 'Order Inquiry',
  shipping: 'Shipping Question',
  return: 'Return/Refund Request',
  billing: 'Billing Issue',
  product: 'Product Question',
  technical: 'Technical Support',
  feedback: 'Feedback/Suggestion',
  other: 'General Inquiry',
}

const supportQuickLinkBase = '/contact'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildSupportRequestLink = (subject: string, message: string) => {
  const params = new URLSearchParams({ subject, message })
  return `${supportQuickLinkBase}?${params.toString()}`
}

const getLoyaltySnapshot = (totalSpent: number) => {
  const points = Math.floor(totalSpent)
  const tiers = [
    { name: 'Bronze', minimum: 0 },
    { name: 'Silver', minimum: 500 },
    { name: 'Gold', minimum: 1500 },
    { name: 'Platinum', minimum: 3000 },
  ]

  const currentTier =
    [...tiers].reverse().find((tier) => points >= tier.minimum) || tiers[0]
  const nextTier = tiers.find((tier) => tier.minimum > points) || null

  return {
    points,
    tier: currentTier.name,
    nextTier: nextTier?.name || 'Top tier reached',
    pointsToNextTier: nextTier ? nextTier.minimum - points : 0,
  }
}

const tableExists = async (tableName: string) => {
  const result = await query(`SELECT to_regclass($1) as regclass`, [
    `public.${tableName}`,
  ])

  return !!result.rows[0]?.regclass
}

const columnExists = async (tableName: string, columnName: string) => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) as exists`,
    [tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

const buildReplyEmailHtml = (recipientName: string, body: string) => {
  const escapedBody = escapeHtml(body).replace(/\n/g, '<br />')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reply from TechTools Support</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:32px 40px;color:#ffffff;">
        <h1 style="margin:0;font-size:24px;font-weight:700;">TechTools Support</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Personalized support from the TechTools team</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 40px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:16px;">Hi ${escapeHtml(
          recipientName || 'there',
        )},</p>
        <div style="margin:0 0 24px;color:#334155;font-size:14px;line-height:1.8;">${escapedBody}</div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 18px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#9a3412;font-weight:600;font-size:13px;">Need more help?</p>
          <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.7;">Reply directly to this email, open live chat on TechTools, or visit the support center for order tracking, returns, and expert product guidance.</p>
        </div>
        <p style="margin:0;color:#475569;font-size:14px;">Best regards,<br />TechTools Support Team</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const buildContactAdminAlertHtml = (data: {
  ticketNumber: string
  name: string
  email: string
  phone?: string
  subjectLabel: string
  orderNumber?: string
  message: string
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Support Request</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:32px 40px;color:#ffffff;">
        <h1 style="margin:0;font-size:24px;font-weight:700;">New Contact Request</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Ticket ${
          data.ticketNumber
        }</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 40px;">
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Name:</strong> ${escapeHtml(
          data.name,
        )}</p>
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Email:</strong> ${escapeHtml(
          data.email,
        )}</p>
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Phone:</strong> ${escapeHtml(
          data.phone || 'Not provided',
        )}</p>
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Subject:</strong> ${escapeHtml(
          data.subjectLabel,
        )}</p>
        <p style="margin:0 0 18px;color:#0f172a;font-size:14px;"><strong>Order Number:</strong> ${escapeHtml(
          data.orderNumber || 'Not provided',
        )}</p>
        <div style="background:#fff7ed;border-left:4px solid #f97316;padding:18px;border-radius:0 10px 10px 0;">
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(
            data.message,
          )}</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`

/**
 * Submit contact form
 * Public endpoint - no authentication required
 */
export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, orderNumber, message } =
      req.body as ContactFormData

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, subject, and message are required',
      })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
      })
    }

    const recipientEmail = getRecipientEmail(subject)
    const subjectLabel = subjectLabels[subject] || 'General Inquiry'

    // Generate unique ticket number
    const ticketNumber = `TT-${Date.now()
      .toString(36)
      .toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`

    // Create email HTML for support team
    const supportEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">New Contact Form Submission</h1>
        <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ticket #${ticketNumber}</p>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 40px;">
        <!-- Customer Info -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 12px; padding: 20px;">
          <tr>
            <td style="padding: 20px;">
              <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">Customer Information</h2>
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                <strong style="color: #1e293b;">Name:</strong> ${name}
              </p>
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                <strong style="color: #1e293b;">Email:</strong> <a href="mailto:${email}" style="color: #f97316;">${email}</a>
              </p>
              ${
                phone
                  ? `
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                <strong style="color: #1e293b;">Phone:</strong> <a href="tel:${phone}" style="color: #f97316;">${phone}</a>
              </p>
              `
                  : ''
              }
              ${
                orderNumber
                  ? `
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                <strong style="color: #1e293b;">Order Number:</strong> ${orderNumber}
              </p>
              `
                  : ''
              }
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                <strong style="color: #1e293b;">Subject:</strong> ${subjectLabel}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Message -->
        <div style="margin-bottom: 30px;">
          <h2 style="margin: 0 0 15px; color: #1e293b; font-size: 18px; font-weight: 600;">Message</h2>
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
        
        <!-- Reply Button -->
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center;">
              <a href="mailto:${email}?subject=Re: ${subjectLabel} - Ticket #${ticketNumber}" 
                 style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Reply to Customer
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #1e293b; padding: 25px 40px; text-align: center;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
          This message was sent from the TechTools contact form
        </p>
        <p style="margin: 8px 0 0; color: #64748b; font-size: 11px;">
          Received at ${new Date().toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`

    // Create confirmation email for customer
    const customerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Received Your Message</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px; text-align: center;">
        <div style="width: 70px; height: 70px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px;">✉️</span>
        </div>
        <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">We Got Your Message!</h1>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 40px;">
        <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
          Hi ${name},
        </p>
        
        <p style="margin: 0 0 25px; color: #64748b; font-size: 14px; line-height: 1.8;">
          Thank you for reaching out to TechTools! We've received your message and our team is on it. 
          You can expect a response within <strong style="color: #1e293b;">24 hours</strong>.
        </p>
        
        <!-- Ticket Info -->
        <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
          <p style="margin: 0 0 5px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Ticket Number</p>
          <p style="margin: 0; color: #ea580c; font-size: 24px; font-weight: 700; letter-spacing: 2px;">${ticketNumber}</p>
          <p style="margin: 10px 0 0; color: #78716c; font-size: 12px;">Save this number for future reference</p>
        </div>
        
        <!-- Summary -->
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
          <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">Your Message Summary</h3>
          <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
            <strong style="color: #1e293b;">Subject:</strong> ${subjectLabel}
          </p>
          ${
            orderNumber
              ? `
          <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
            <strong style="color: #1e293b;">Order Number:</strong> ${orderNumber}
          </p>
          `
              : ''
          }
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            <strong style="color: #1e293b;">Submitted:</strong> ${new Date().toLocaleString(
              'en-US',
              { dateStyle: 'medium', timeStyle: 'short' },
            )}
          </p>
        </div>
        
        <!-- Quick Links -->
        <div style="text-align: center; margin-bottom: 25px;">
          <p style="margin: 0 0 15px; color: #64748b; font-size: 14px;">Need immediate help?</p>
          <a href="https://techtoolstore.com/faq" style="display: inline-block; color: #f97316; text-decoration: none; font-weight: 600; font-size: 14px; margin: 0 15px;">
            📚 Browse FAQs
          </a>
          <a href="https://techtoolstore.com/orders" style="display: inline-block; color: #f97316; text-decoration: none; font-weight: 600; font-size: 14px; margin: 0 15px;">
            📦 Track Order
          </a>
        </div>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
        <p style="margin: 0 0 5px; color: #ffffff; font-size: 16px; font-weight: 600;">TechTools</p>
        <p style="margin: 0 0 15px; color: #94a3b8; font-size: 12px;">Premium Automotive Accessories</p>
        <div style="margin: 15px 0;">
          <a href="https://techtoolstore.com" style="color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 10px;">Website</a>
          <span style="color: #475569;">|</span>
          <a href="https://techtoolstore.com/contact" style="color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 10px;">Contact</a>
          <span style="color: #475569;">|</span>
          <a href="https://techtoolstore.com/privacy" style="color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 10px;">Privacy</a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 11px;">
          © ${new Date().getFullYear()} TechTools. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`

    if (!emailService.isConfigured()) {
      logger.warn(
        'Email service not configured. Contact form received but emails not sent.',
      )

      // Still log the contact submission
      await logContactSubmission({
        ticketNumber,
        name,
        email,
        phone,
        subject: subjectLabel,
        orderNumber,
        message,
        status: 'pending', // No emails sent
      })

      return res.status(200).json({
        success: true,
        message:
          'Your message has been received. We will get back to you soon.',
        ticketNumber,
      })
    }

    let emailsSent = false
    try {
      const teamEmailResult = await emailService.sendEmail({
        to: recipientEmail,
        replyTo: email,
        subject: `[${subjectLabel}] New Contact Form - ${ticketNumber}`,
        html: supportEmailHtml,
        text: message,
        emailType: 'custom',
      })

      const adminAlertResult = await emailService.sendAdminNotification({
        subject: `Support request ${ticketNumber}: ${subjectLabel}`,
        html: buildContactAdminAlertHtml({
          ticketNumber,
          name,
          email,
          phone,
          subjectLabel,
          orderNumber,
          message,
        }),
        text: message,
        replyTo: email,
        emailType: 'custom',
      })

      const customerEmailResult = await emailService.sendEmail({
        to: email,
        subject: `We received your message - Ticket #${ticketNumber}`,
        html: customerEmailHtml,
        emailType: 'custom',
      })

      emailsSent =
        teamEmailResult.success ||
        customerEmailResult.success ||
        adminAlertResult.success
    } catch (emailError) {
      logger.warn(
        'Failed to send contact form emails, but submission was saved:',
        emailError,
      )
    }

    // Log the contact submission
    await logContactSubmission({
      ticketNumber,
      name,
      email,
      phone,
      subject: subjectLabel,
      orderNumber,
      message,
      status: emailsSent ? 'sent' : 'pending',
    })

    res.status(200).json({
      success: true,
      message: emailsSent
        ? 'Your message has been sent successfully. Check your email for confirmation.'
        : 'Your message has been received. We will get back to you soon.',
      ticketNumber,
    })
  } catch (error) {
    logger.error('Contact form submission error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send your message. Please try again later.',
    })
  }
}

/**
 * Log contact submission to database
 */
async function logContactSubmission(data: {
  ticketNumber: string
  name: string
  email: string
  phone?: string
  subject: string
  orderNumber?: string
  message: string
  status: string
}) {
  try {
    const hasMetadata = await columnExists('email_messages', 'metadata')
    const metadata = {
      recordType: 'contact_form',
      ticketNumber: data.ticketNumber,
      phone: data.phone,
      orderNumber: data.orderNumber,
      message: data.message,
    }

    try {
      if (hasMetadata) {
        await query(
          `INSERT INTO email_messages (
            email_type, recipient_email, recipient_name, subject, status, metadata, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'contact_form',
            data.email,
            data.name,
            data.subject,
            data.status,
            JSON.stringify(metadata),
            new Date(),
          ],
        )
      } else {
        await query(
          `INSERT INTO email_messages (
            email_type, recipient_email, recipient_name, subject, status, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            'custom',
            data.email,
            data.name,
            `[Contact] ${data.subject}`,
            data.status,
            new Date(),
          ],
        )
      }
    } catch (insertError) {
      if (hasMetadata) {
        await query(
          `INSERT INTO email_messages (
            email_type, recipient_email, recipient_name, subject, status, metadata, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'custom',
            data.email,
            data.name,
            `[Contact] ${data.subject}`,
            data.status,
            JSON.stringify(metadata),
            new Date(),
          ],
        )
      } else {
        throw insertError
      }
    }
  } catch (error) {
    // Table might not exist, just log and continue
    logger.warn('Could not log contact submission to database:', error)
  }
}

/**
 * Get all contact submissions (admin only)
 * This will be added to email routes for admin dashboard
 */
export const getContactSubmissions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const hasMetadata = await columnExists('email_messages', 'metadata')
    const contactWhereClause = hasMetadata
      ? `email_type = 'contact_form'
          OR (
            email_type = 'custom'
            AND metadata IS NOT NULL
            AND metadata->>'recordType' = 'contact_form'
          )`
      : `email_type = 'contact_form' OR subject ILIKE '[Contact] %'`

    const result = await query(
      `SELECT * FROM email_messages 
       WHERE ${contactWhereClause}
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )

    const countResult = await query(
      `SELECT COUNT(*) FROM email_messages
       WHERE ${contactWhereClause}`,
    )

    res.json({
      success: true,
      data: {
        submissions: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].count) / Number(limit),
          ),
        },
      },
    })
  } catch (error) {
    logger.error('Get contact submissions error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get contact submissions',
    })
  }
}

export const replyToContactSubmission = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params
    const { body, subject } = req.body as ReplySubmissionData
    const hasMetadata = await columnExists('email_messages', 'metadata')

    if (!body?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Reply body is required',
      })
    }

    const submissionResult = await query(
      `SELECT * FROM email_messages
       WHERE id = $1
         AND (${
           hasMetadata
             ? `email_type = 'contact_form'
           OR (
             email_type = 'custom'
             AND metadata IS NOT NULL
             AND metadata->>'recordType' = 'contact_form'
           )`
             : `email_type = 'contact_form' OR subject ILIKE '[Contact] %'`
         })
       LIMIT 1`,
      [id],
    )

    const submission = submissionResult.rows[0]

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Contact submission not found',
      })
    }

    const metadata =
      typeof submission.metadata === 'string'
        ? JSON.parse(submission.metadata)
        : submission.metadata || {}
    const ticketNumber = metadata.ticketNumber || 'Support Request'
    const replySubject =
      subject?.trim() || `Re: ${submission.subject} - ${ticketNumber}`

    const sendResult = await emailService.sendEmail({
      to: submission.recipient_email,
      toName: submission.recipient_name,
      subject: replySubject,
      html: buildReplyEmailHtml(submission.recipient_name, body.trim()),
      text: body.trim(),
      emailType: 'custom',
      replyTo: getRecipientEmail('technical'),
    })

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: sendResult.error || 'Failed to send reply',
      })
    }

    const nextMetadata = {
      ...metadata,
      lastReplyPreview: body.trim().slice(0, 200),
      lastReplySubject: replySubject,
      lastRepliedAt: new Date().toISOString(),
      lastRepliedBy: req.user?.email || 'admin',
    }

    await query(
      `UPDATE email_messages
       SET status = 'sent',
           metadata = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify(nextMetadata)],
    )

    res.json({
      success: true,
      message: 'Reply sent successfully',
    })
  } catch (error) {
    logger.error('Reply to contact submission error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send reply',
    })
  }
}

export const getSupportProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const [reviewsHasStatus, productMediaExists, productImagesExists] =
      await Promise.all([
        columnExists('reviews', 'status'),
        tableExists('product_media'),
        tableExists('product_images'),
      ])

    const reviewsApprovalClause = reviewsHasStatus
      ? `r.status = 'approved'`
      : `r.is_approved = true`

    const primaryImageSelect = productMediaExists
      ? `(
           SELECT pm.url
           FROM product_media pm
           WHERE pm.product_id = p.id AND pm.is_primary = true
           ORDER BY pm.position ASC NULLS LAST
           LIMIT 1
         )`
      : productImagesExists
      ? `(
             SELECT pi.image_url
             FROM product_images pi
             WHERE pi.product_id = p.id AND pi.is_primary = true
             ORDER BY pi.display_order ASC NULLS LAST
             LIMIT 1
           )`
      : 'NULL'

    const [userResult, orderSummaryResult, recentOrderResult, reviewsResult] =
      await Promise.all([
        query(
          `SELECT id, email, first_name, last_name, created_at, email_verified
           FROM users WHERE id = $1 LIMIT 1`,
          [userId],
        ),
        query(
          `SELECT
             COUNT(*)::int as total_orders,
             COALESCE(SUM(total_amount), 0)::numeric as total_spent,
             COUNT(*) FILTER (WHERE order_status IN ('pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped'))::int as active_orders,
             MAX(created_at) as last_order_at
           FROM orders
           WHERE user_id = $1`,
          [userId],
        ),
        query(
          `SELECT id,
                  order_number,
                  order_status as status,
                  total_amount as total,
                  created_at
           FROM orders
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId],
        ),
        query(
          `SELECT r.id,
                  p.id as product_id,
                  p.name as product_name,
                  p.slug as product_slug,
                  r.rating,
                  r.title,
                  r.comment,
                  r.is_verified_purchase,
                  r.created_at
           FROM reviews r
           JOIN products p ON p.id = r.product_id
           WHERE r.user_id = $1 AND ${reviewsApprovalClause}
           ORDER BY r.created_at DESC
           LIMIT 3`,
          [userId],
        ),
      ])

    const user = userResult.rows[0]

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const recommendationResult = await query(
      `WITH purchased_products AS (
         SELECT DISTINCT oi.product_id
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.user_id = $1
       ),
       favorite_categories AS (
         SELECT p.category_id, COUNT(*) as score
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         WHERE o.user_id = $1
         GROUP BY p.category_id
         ORDER BY score DESC
         LIMIT 2
       )
       SELECT p.id,
              p.name,
              p.slug,
              p.base_price,
              p.sale_price,
              c.name as category_name,
        ${primaryImageSelect} as primary_image
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true
         AND p.id NOT IN (SELECT product_id FROM purchased_products)
         AND (
           p.is_featured = true
           OR p.category_id IN (SELECT category_id FROM favorite_categories)
         )
       ORDER BY p.is_featured DESC, p.created_at DESC
       LIMIT 4`,
      [userId],
    )

    const orderSummary = orderSummaryResult.rows[0] || {
      total_orders: 0,
      total_spent: 0,
      active_orders: 0,
      last_order_at: null,
    }

    const totalSpent = Number(orderSummary.total_spent || 0)
    const totalOrders = Number(orderSummary.total_orders || 0)
    const loyalty = getLoyaltySnapshot(totalSpent)
    const recentOrder = recentOrderResult.rows[0] || null
    const smartSuggestions = [
      totalOrders > 0
        ? `Welcome back ${user.first_name}. You have ${
            orderSummary.active_orders
          } active order${
            orderSummary.active_orders === 1 ? '' : 's'
          } and ${totalOrders} total purchases.`
        : `Welcome ${user.first_name}. Chat with us for buying advice, installation help, or tailored product recommendations.`,
      recentOrder
        ? `Latest order ${recentOrder.order_number} is ${recentOrder.status}. Open chat if you need shipping help or a faster resolution.`
        : 'Need help deciding? Our concierge can recommend accessories based on your interests and current deals.',
      reviewsResult.rows.length > 0
        ? `You already have ${reviewsResult.rows.length} approved review${
            reviewsResult.rows.length === 1 ? '' : 's'
          }. We can surface verified proof points while you chat.`
        : 'After purchase, support can help you leave verified reviews and unlock reward perks.',
      loyalty.points > 0
        ? `You currently have ${loyalty.points} TechTools reward points and ${loyalty.pointsToNextTier} points to ${loyalty.nextTier}.`
        : 'Your first purchase starts your TechTools rewards balance immediately.',
    ]

    const quickActions = [
      {
        type: 'video_support',
        label: 'Request video support',
        description:
          'For complex installs, diagnostics, or premium product walkthroughs.',
        href: buildSupportRequestLink(
          'technical',
          recentOrder
            ? `I need a video support session for order ${recentOrder.order_number}.`
            : 'I need a video support session for a product question.',
        ),
      },
      {
        type: 'appointment_booking',
        label: 'Book expert appointment',
        description: 'Reserve a guided shopping or post-purchase support slot.',
        href: buildSupportRequestLink(
          'product',
          'I want to book an appointment with a TechTools product specialist.',
        ),
      },
      {
        type: 'cobrowsing',
        label: 'Request co-browsing help',
        description:
          'Ask an agent to guide you through checkout, setup, or troubleshooting.',
        href: buildSupportRequestLink(
          'technical',
          'I want a co-browsing support session so an agent can guide me live.',
        ),
      },
      {
        type: 'track_order',
        label: 'Track my order',
        description: 'Open the order tracking view instantly.',
        href: '/track-order',
      },
    ]

    res.json({
      success: true,
      data: {
        customer: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`.trim(),
          joinedAt: user.created_at,
          isVerified: !!user.email_verified,
        },
        orderSummary: {
          totalOrders,
          totalSpent,
          activeOrders: Number(orderSummary.active_orders || 0),
          averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
          lastOrderAt: orderSummary.last_order_at,
        },
        recentOrder,
        loyalty,
        verifiedReviews: reviewsResult.rows.map((review) => ({
          id: review.id,
          productId: review.product_id,
          productName: review.product_name,
          productSlug: review.product_slug,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isVerifiedPurchase: review.is_verified_purchase,
          createdAt: review.created_at,
        })),
        recommendations: recommendationResult.rows.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          price: Number(item.sale_price || item.base_price || 0),
          primaryImage: item.primary_image,
          categoryName: item.category_name,
          reason: item.category_name
            ? `Recommended from your ${item.category_name} shopping pattern`
            : 'Featured by TechTools concierge',
        })),
        smartSuggestions,
        quickActions,
      },
    })
  } catch (error) {
    logger.error('Get support profile error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get support profile',
    })
  }
}
