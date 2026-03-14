import nodemailer from 'nodemailer'
import logger from './logger'

// ============================================
// Email Configuration
// ============================================

// Create reusable transporter
const createTransporter = () => {
  // Use environment variables for SMTP config
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// Company info for email templates
const COMPANY_NAME = 'TechTools Store'
const COMPANY_EMAIL = process.env.SMTP_FROM || 'noreply@techtoolstore.com'
const COMPANY_WEBSITE = process.env.FRONTEND_URL || 'https://techtoolstore.com'

// ============================================
// Email Templates
// ============================================

const getEmailHeader = () => `
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">⚡ ${COMPANY_NAME}</h1>
  </div>
`

const getEmailFooter = () => `
  <div style="background: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
      Thank you for shopping with ${COMPANY_NAME}!
    </p>
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      ${COMPANY_WEBSITE} | support@techtoolstore.com
    </p>
    <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 11px;">
      © ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
    </p>
  </div>
`

const getBaseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    ${getEmailHeader()}
    <div style="padding: 30px 20px;">
      ${content}
    </div>
    ${getEmailFooter()}
  </div>
</body>
</html>
`

// ============================================
// Send Email Helper
// ============================================

const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<boolean> => {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP not configured. Email not sent:', { to, subject })
      return false
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: `"${COMPANY_NAME}" <${COMPANY_EMAIL}>`,
      to,
      subject,
      html,
    }

    const info = await transporter.sendMail(mailOptions)
    logger.info('Email sent successfully:', {
      to,
      subject,
      messageId: info.messageId,
    })
    return true
  } catch (error) {
    logger.error('Failed to send email:', { to, subject, error })
    return false
  }
}

// ============================================
// Email Functions
// ============================================

export const sendVerificationEmail = async (
  email: string,
  verificationToken: string,
): Promise<void> => {
  const verificationLink = `${COMPANY_WEBSITE}/verify-email?token=${verificationToken}`

  const content = `
    <h2 style="color: #1f2937; margin: 0 0 20px 0;">Verify Your Email</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Welcome to ${COMPANY_NAME}! Please verify your email address by clicking the button below:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationLink}" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Verify Email
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `

  await sendEmail(
    email,
    `Verify Your Email - ${COMPANY_NAME}`,
    getBaseTemplate(content),
  )
}

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
): Promise<void> => {
  const resetLink = `${COMPANY_WEBSITE}/reset-password?token=${resetToken}`

  const content = `
    <h2 style="color: #1f2937; margin: 0 0 20px 0;">Reset Your Password</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      We received a request to reset your password. Click the button below to create a new password:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This link expires in 1 hour. If you didn't request a password reset, please ignore this email.
    </p>
  `

  await sendEmail(
    email,
    `Reset Your Password - ${COMPANY_NAME}`,
    getBaseTemplate(content),
  )
}

export interface OrderItem {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface OrderDetails {
  orderNumber: string
  customerName: string
  customerEmail: string
  items: OrderItem[]
  subtotal: number
  taxAmount: number
  shippingAmount: number
  grandTotal: number
  shippingAddress: {
    firstName?: string
    lastName?: string
    address: string
    city: string
    state?: string
    postalCode: string
    country: string
  }
  estimatedDelivery?: string
}

export const sendOrderConfirmationEmail = async (
  email: string,
  orderDetails: OrderDetails,
): Promise<boolean> => {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const itemsHtml = orderDetails.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #1f2937; font-weight: 500;">${
            item.productName
          }</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
          x${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937; font-weight: 500;">
          ${formatCurrency(item.totalPrice)}
        </td>
      </tr>
    `,
    )
    .join('')

  const shippingAddr = orderDetails.shippingAddress

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 30px;">✓</span>
      </div>
      <h2 style="color: #1f2937; margin: 0 0 10px 0;">Order Confirmed!</h2>
      <p style="color: #6b7280; margin: 0;">
        Thank you for your order, ${orderDetails.customerName}!
      </p>
    </div>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Order Number</p>
      <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 20px; font-weight: bold;">${
        orderDetails.orderNumber
      }</p>
    </div>

    <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Order Summary</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; text-transform: uppercase;">Item</th>
          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; text-transform: uppercase;">Qty</th>
          <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; text-transform: uppercase;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="border-top: 2px solid #e5e7eb; padding-top: 15px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">Subtotal</span>
        <span style="color: #1f2937;">${formatCurrency(
          orderDetails.subtotal,
        )}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">Shipping</span>
        <span style="color: ${
          orderDetails.shippingAmount === 0 ? '#16a34a' : '#1f2937'
        };">
          ${
            orderDetails.shippingAmount === 0
              ? 'FREE'
              : formatCurrency(orderDetails.shippingAmount)
          }
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <span style="color: #6b7280;">Tax</span>
        <span style="color: #1f2937;">${formatCurrency(
          orderDetails.taxAmount,
        )}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 15px; border-top: 2px solid #1f2937;">
        <span style="color: #1f2937; font-weight: bold; font-size: 18px;">Total</span>
        <span style="color: #f97316; font-weight: bold; font-size: 18px;">${formatCurrency(
          orderDetails.grandTotal,
        )}</span>
      </div>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 14px;">Shipping Address</h3>
      <p style="color: #4b5563; margin: 0; line-height: 1.6;">
        ${shippingAddr.firstName || ''} ${shippingAddr.lastName || ''}<br>
        ${shippingAddr.address}<br>
        ${shippingAddr.city}${
    shippingAddr.state ? `, ${shippingAddr.state}` : ''
  } ${shippingAddr.postalCode}<br>
        ${shippingAddr.country}
      </p>
    </div>

    ${
      orderDetails.estimatedDelivery
        ? `
    <div style="margin-top: 20px; text-align: center;">
      <p style="color: #6b7280; margin: 0;">
        📦 Estimated Delivery: <strong style="color: #1f2937;">${orderDetails.estimatedDelivery}</strong>
      </p>
    </div>
    `
        : ''
    }

    <div style="text-align: center; margin-top: 30px;">
      <a href="${COMPANY_WEBSITE}/orders" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Track Your Order
      </a>
    </div>
  `

  return await sendEmail(
    email,
    `Order Confirmed #${orderDetails.orderNumber} - ${COMPANY_NAME}`,
    getBaseTemplate(content),
  )
}

export const sendWelcomeEmail = async (
  email: string,
  name: string,
): Promise<void> => {
  const content = `
    <h2 style="color: #1f2937; margin: 0 0 20px 0;">Welcome to ${COMPANY_NAME}! 🎉</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${name},<br><br>
      Thank you for joining ${COMPANY_NAME}! We're excited to have you as part of our community.
    </p>
    <p style="color: #4b5563; line-height: 1.6;">
      Start exploring our collection of premium tech tools and accessories. As a new member, enjoy exclusive deals and early access to new products!
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${COMPANY_WEBSITE}/shop" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Start Shopping
      </a>
    </div>
  `

  await sendEmail(
    email,
    `Welcome to ${COMPANY_NAME}!`,
    getBaseTemplate(content),
  )
}

export const sendAdminInvitationEmail = async (
  email: string,
  token: string,
  role: string,
): Promise<void> => {
  const invitationLink = `${
    process.env.ADMIN_DASHBOARD_URL || COMPANY_WEBSITE
  }/admin/accept-invitation?token=${token}`

  const content = `
    <h2 style="color: #1f2937; margin: 0 0 20px 0;">You've Been Invited! 🎉</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      You've been invited to join ${COMPANY_NAME} as a <strong>${role}</strong>.
    </p>
    <p style="color: #4b5563; line-height: 1.6;">
      Click the button below to accept the invitation and set up your account:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationLink}" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This invitation expires in 7 days.
    </p>
  `

  await sendEmail(
    email,
    `You're Invited to ${COMPANY_NAME}`,
    getBaseTemplate(content),
  )
}

export const sendOrderStatusUpdateEmail = async (
  email: string,
  orderNumber: string,
  customerName: string,
  newStatus: string,
  message?: string,
): Promise<boolean> => {
  const statusEmoji: Record<string, string> = {
    processing: '🔄',
    shipped: '📦',
    delivered: '✅',
    cancelled: '❌',
    refunded: '💰',
  }

  const statusColor: Record<string, string> = {
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#16a34a',
    cancelled: '#dc2626',
    refunded: '#f59e0b',
  }

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="font-size: 50px; margin-bottom: 15px;">${
        statusEmoji[newStatus] || '📋'
      }</div>
      <h2 style="color: #1f2937; margin: 0 0 10px 0;">Order Status Update</h2>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${customerName},<br><br>
      Your order <strong>#${orderNumber}</strong> has been updated:
    </p>

    <div style="background: ${
      statusColor[newStatus] || '#6b7280'
    }15; border-left: 4px solid ${
    statusColor[newStatus] || '#6b7280'
  }; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: ${
        statusColor[newStatus] || '#6b7280'
      }; font-weight: bold; font-size: 18px; text-transform: capitalize;">
        ${newStatus}
      </p>
      ${
        message
          ? `<p style="margin: 10px 0 0 0; color: #4b5563;">${message}</p>`
          : ''
      }
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${COMPANY_WEBSITE}/orders/${orderNumber}" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        View Order Details
      </a>
    </div>
  `

  return await sendEmail(
    email,
    `Order #${orderNumber} - ${
      newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
    }`,
    getBaseTemplate(content),
  )
}
