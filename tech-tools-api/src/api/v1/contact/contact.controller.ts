import { Request, Response } from 'express'
import nodemailer from 'nodemailer'
import logger from '../../../utils/logger'
import { query } from '../../../database/connection'

// Create email transporter
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null
  }

  const port = parseInt(process.env.SMTP_PORT || '465')
  // Port 465 uses implicit TLS (secure: true)
  // Port 587 uses STARTTLS (secure: false)
  const secure = process.env.SMTP_SECURE 
    ? process.env.SMTP_SECURE === 'true'
    : port === 465

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// Contact form submission types
interface ContactFormData {
  name: string
  email: string
  phone?: string
  subject: string
  orderNumber?: string
  message: string
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

    // Ensure transporter is ready
    const emailTransporter = createTransporter()

    if (!emailTransporter) {
      logger.warn(
        'Email transporter not configured. Contact form received but emails not sent.',
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

    // Try to send emails (but don't fail the request if emails fail)
    let emailsSent = false
    try {
      // Send email to support team
      await emailTransporter.sendMail({
        from: `"TechTools Contact Form" <${
          process.env.SMTP_USER || 'noreply@techtoolstore.com'
        }>`,
        to: recipientEmail,
        replyTo: email,
        subject: `[${subjectLabel}] New Contact Form - ${ticketNumber}`,
        html: supportEmailHtml,
      })

      logger.info(`Contact form email sent to support: ${recipientEmail}`)

      // Send confirmation email to customer
      await emailTransporter.sendMail({
        from: `"TechTools" <${
          process.env.SMTP_USER || 'noreply@techtoolstore.com'
        }>`,
        to: email,
        subject: `We received your message - Ticket #${ticketNumber}`,
        html: customerEmailHtml,
      })

      logger.info(`Contact form confirmation sent to customer: ${email}`)
      emailsSent = true
    } catch (emailError) {
      logger.warn('Failed to send contact form emails, but submission was saved:', emailError)
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
    // Log to email_messages table if it exists
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
        JSON.stringify({
          ticketNumber: data.ticketNumber,
          phone: data.phone,
          orderNumber: data.orderNumber,
          message: data.message,
        }),
        new Date(),
      ],
    )
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

    const result = await query(
      `SELECT * FROM email_messages 
       WHERE email_type = 'contact_form' 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )

    const countResult = await query(
      `SELECT COUNT(*) FROM email_messages WHERE email_type = 'contact_form'`,
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
