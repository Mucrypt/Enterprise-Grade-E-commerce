/**
 * PAYMENT & CONTACT CONTROLLER INTEGRATION
 *
 * Add these to your payments and contact controllers
 */

// Add these imports
import NotificationEvents from '../../../services/notification.events'
import { NotificationService } from '../../../services/notification.service'

/**
 * PAYMENT INTEGRATION
 */

/**
 * EXAMPLE: When payment is successfully received
 */
export const paymentReceivedNotificationExample = async (
  userId: string,
  paymentData: {
    id: string
    order_id: string
    amount: number
    transaction_id: string
  },
) => {
  try {
    await NotificationEvents.onPaymentReceived(userId, paymentData)
    console.log('Payment notification sent')
  } catch (error) {
    console.error('Error sending payment notification:', error)
  }
}

/**
 * EXAMPLE: When payment fails
 */
export const paymentFailedNotificationExample = async (
  userId: string,
  paymentData: {
    id: string
    order_id: string
    amount: number
    error: string
  },
) => {
  try {
    await NotificationEvents.onPaymentFailed(userId, paymentData)
    console.log('Payment failure notification sent')
  } catch (error) {
    console.error('Error sending payment failure notification:', error)
  }
}

/**
 * CONTACT FORM INTEGRATION
 */

/**
 * EXAMPLE: When contact message is received
 */
export const contactMessageNotificationExample = async (contactData: {
  id: string
  name: string
  email: string
  subject: string
  message: string
  type: string // 'support', 'sales', 'billing', etc.
}) => {
  try {
    // Notify admins
    await NotificationEvents.onContactMessageReceived(contactData)

    // Also send to specific admin based on type
    const adminGroups: Record<string, string> = {
      support: 'support@techtoolstore.com',
      sales: 'sales@techtoolstore.com',
      billing: 'billing@techtoolstore.com',
    }

    const adminEmail =
      adminGroups[contactData.type] || 'admin@techtoolstore.com'

    // Send detailed email to admin
    const emailService = await import('../../../utils/email')
    await emailService.sendEmail({
      to: adminEmail,
      subject: `New ${contactData.type.toUpperCase()} Inquiry: ${
        contactData.subject
      }`,
      html: `
        <h2>New Message from Contact Form</h2>
        <p><strong>From:</strong> ${contactData.name} (${contactData.email})</p>
        <p><strong>Type:</strong> ${contactData.type}</p>
        <p><strong>Subject:</strong> ${contactData.subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${contactData.message}</p>
      `,
    })

    console.log('Contact message notification sent')
  } catch (error) {
    console.error('Error sending contact notification:', error)
  }
}

/**
 * INVENTORY/STOCK INTEGRATION
 */

/**
 * EXAMPLE: When product stock is low
 */
export const lowStockNotificationExample = async (
  productId: string,
  productName: string,
  stockQty: number,
  threshold: number = 10,
) => {
  if (stockQty <= threshold) {
    try {
      await NotificationEvents.onLowStockAlert(productId, productName, stockQty)
      console.log(`Low stock alert: ${productName} (${stockQty} units)`)
    } catch (error) {
      console.error('Error sending low stock notification:', error)
    }
  }
}

/**
 * EXAMPLE: When product is back in stock
 * (For users with wishlist items)
 */
export const backInStockNotificationExample = async (
  productId: string,
  productName: string,
) => {
  try {
    // Get users who have this product in wishlist
    const wishlistResult = await query(
      `SELECT DISTINCT user_id FROM wishlists WHERE product_id = $1`,
      [productId],
    )

    // Send notification to each user
    for (const row of wishlistResult.rows) {
      await NotificationEvents.onBackInStock(
        row.user_id,
        productName,
        productId,
      )
    }

    console.log(`Back in stock notifications sent for ${productName}`)
  } catch (error) {
    console.error('Error sending back in stock notification:', error)
  }
}

/**
 * REVIEW INTEGRATION
 */

/**
 * EXAMPLE: When customer submits a review
 */
export const reviewSubmittedNotificationExample = async (reviewData: {
  id: string
  product_id: string
  product_name: string
  user_id: string
  rating: number
  title: string
  comment: string
}) => {
  try {
    // Notify admins about new review
    await NotificationEvents.onReviewSubmitted(reviewData.user_id, reviewData)

    // Optionally notify product owner
    const productResult = await query(
      `SELECT created_by FROM products WHERE id = $1`,
      [reviewData.product_id],
    )

    if (productResult.rows[0]?.created_by) {
      await NotificationService.create({
        userId: productResult.rows[0].created_by,
        type: 'review_submitted',
        title: 'New Review on Your Product',
        message: `${reviewData.user_id} left a ${reviewData.rating}-star review on ${reviewData.product_name}`,
        actionUrl: `/products/${reviewData.product_id}#reviews`,
        actionLabel: 'View Review',
      })
    }

    console.log('Review notification sent')
  } catch (error) {
    console.error('Error sending review notification:', error)
  }
}
