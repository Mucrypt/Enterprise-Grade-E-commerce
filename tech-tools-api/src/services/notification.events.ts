import NotificationService, {
  NotificationPayload,
} from './notification.service'
import { query as dbQuery } from '../database/connection'
import logger from '../utils/logger'

/**
 * Notification Event Handlers
 * These are called from various parts of the application when events occur
 */

export class NotificationEvents {
  /**
   * Trigger when a user signs up
   */
  static async onUserSignup(userId: string, userName: string) {
    try {
      // Send to user
      await NotificationService.create({
        userId,
        type: 'user_signup',
        title: 'Welcome to TechTools!',
        message: `Welcome, ${userName}! Your account has been created.`,
        description: 'Start exploring amazing tech tools and products.',
        icon: 'UserCheck',
        actionUrl: '/products',
        actionLabel: 'Browse Products',
        sendEmail: true,
        priority: 'normal',
      })

      // Notify all admins
      const adminResult = await dbQuery(
        `SELECT id FROM users WHERE user_type IN ('admin', 'super_admin') LIMIT 10`,
      )

      for (const admin of adminResult.rows) {
        await NotificationService.create({
          adminId: admin.id,
          type: 'user_signup',
          title: 'New User Sign Up',
          message: `${userName} has joined TechTools!`,
          data: { userId, userName },
          priority: 'normal',
        })
      }
    } catch (error) {
      logger.error('Error in onUserSignup:', error)
    }
  }

  /**
   * Trigger when an order is placed
   */
  static async onOrderPlaced(userId: string, orderData: any) {
    try {
      // Get user details
      const userResult = await dbQuery(
        `SELECT first_name, email FROM users WHERE id = $1`,
        [userId],
      )
      const user = userResult.rows[0]

      // Send to user
      await NotificationService.create({
        userId,
        type: 'order_placed',
        title: 'Order Placed Successfully',
        message: `Your order ${orderData.order_number} has been placed successfully.`,
        description: `Order Total: $${orderData.grand_total}`,
        icon: 'ShoppingCart',
        actionUrl: `/orders/${orderData.id}`,
        actionLabel: 'View Order',
        data: { orderId: orderData.id, orderNumber: orderData.order_number },
        sendEmail: true,
        priority: 'high',
      })

      // Notify all admins
      const adminResult = await dbQuery(
        `SELECT id FROM users WHERE user_type IN ('admin', 'super_admin') LIMIT 10`,
      )

      for (const admin of adminResult.rows) {
        await NotificationService.create({
          adminId: admin.id,
          type: 'order_placed',
          title: 'New Order Received',
          message: `${user.first_name} placed order ${orderData.order_number} for $${orderData.grand_total}`,
          data: {
            orderId: orderData.id,
            orderNumber: orderData.order_number,
            userId,
            customerName: user.first_name,
          },
          priority: 'high',
        })
      }
    } catch (error) {
      logger.error('Error in onOrderPlaced:', error)
    }
  }

  /**
   * Trigger when order status changes
   */
  static async onOrderStatusChanged(
    userId: string,
    orderId: string,
    oldStatus: string,
    newStatus: string,
  ) {
    try {
      const statusMessages: Record<string, { title: string; message: string }> =
        {
          confirmed: {
            title: 'Order Confirmed',
            message: 'Your order has been confirmed and is being prepared.',
          },
          processing: {
            title: 'Order Processing',
            message: 'Your order is being prepared for shipment.',
          },
          ready_to_ship: {
            title: 'Ready to Ship',
            message: 'Your order is ready and will be shipped soon.',
          },
          shipped: {
            title: 'Order Shipped',
            message: 'Your order has been shipped! Check tracking info.',
          },
          delivered: {
            title: 'Order Delivered',
            message: 'Your order has been delivered successfully!',
          },
          cancelled: {
            title: 'Order Cancelled',
            message:
              'Your order has been cancelled. A refund will be processed shortly.',
          },
        }

      const statusInfo = statusMessages[newStatus]
      if (!statusInfo) return

      // Send to user
      await NotificationService.create({
        userId,
        type: `order_${newStatus}`,
        title: statusInfo.title,
        message: statusInfo.message,
        icon:
          newStatus === 'delivered'
            ? 'Gift'
            : newStatus === 'shipped'
            ? 'Truck'
            : newStatus === 'cancelled'
            ? 'XCircle'
            : 'Clock',
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'View Order',
        data: { orderId, newStatus, oldStatus },
        sendEmail: true,
        priority: newStatus === 'delivered' ? 'normal' : 'normal',
      })
    } catch (error) {
      logger.error('Error in onOrderStatusChanged:', error)
    }
  }

  /**
   * Trigger when payment is received
   */
  static async onPaymentReceived(userId: string, paymentData: any) {
    try {
      await NotificationService.create({
        userId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `Payment of $${paymentData.amount} has been received successfully.`,
        icon: 'CreditCard',
        actionUrl: `/orders/${paymentData.order_id}`,
        actionLabel: 'View Order',
        data: { paymentId: paymentData.id, orderId: paymentData.order_id },
        sendEmail: true,
        priority: 'high',
      })
    } catch (error) {
      logger.error('Error in onPaymentReceived:', error)
    }
  }

  /**
   * Trigger when payment fails
   */
  static async onPaymentFailed(userId: string, paymentData: any) {
    try {
      await NotificationService.create({
        userId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Payment of $${paymentData.amount} could not be processed.`,
        description: 'Please try again with a different payment method.',
        icon: 'AlertTriangle',
        actionUrl: `/checkout/${paymentData.order_id}`,
        actionLabel: 'Retry Payment',
        data: { paymentId: paymentData.id, orderId: paymentData.order_id },
        sendEmail: true,
        priority: 'high',
      })
    } catch (error) {
      logger.error('Error in onPaymentFailed:', error)
    }
  }

  /**
   * Trigger when a new contact message is received
   */
  static async onContactMessageReceived(contactData: any) {
    try {
      // Notify all admins and sales team
      const adminResult = await dbQuery(
        `SELECT id FROM users WHERE user_type IN ('admin', 'super_admin') LIMIT 10`,
      )

      for (const admin of adminResult.rows) {
        await NotificationService.create({
          adminId: admin.id,
          type: 'contact_message',
          title: 'New Contact Message',
          message: `${contactData.name} sent a message: "${contactData.subject}"`,
          data: {
            messageId: contactData.id,
            senderName: contactData.name,
            senderEmail: contactData.email,
            subject: contactData.subject,
          },
          priority: 'high',
        })
      }
    } catch (error) {
      logger.error('Error in onContactMessageReceived:', error)
    }
  }

  /**
   * Trigger when product stock is low
   */
  static async onLowStockAlert(
    productId: string,
    productName: string,
    stockQty: number,
  ) {
    try {
      // Notify all admins
      const adminResult = await dbQuery(
        `SELECT id FROM users WHERE user_type IN ('admin', 'super_admin') LIMIT 10`,
      )

      for (const admin of adminResult.rows) {
        await NotificationService.create({
          adminId: admin.id,
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${productName} is running low (${stockQty} units remaining)`,
          icon: 'AlertTriangle',
          actionUrl: `/products/${productId}`,
          actionLabel: 'View Product',
          data: { productId, productName, stockQty },
          priority: 'normal',
        })
      }
    } catch (error) {
      logger.error('Error in onLowStockAlert:', error)
    }
  }

  /**
   * Trigger when product is back in stock
   */
  static async onBackInStock(
    userId: string,
    productName: string,
    productId: string,
  ) {
    try {
      await NotificationService.create({
        userId,
        type: 'back_in_stock',
        title: 'Back in Stock!',
        message: `${productName} is now back in stock!`,
        description: 'Get it before it runs out again.',
        icon: 'CheckCircle',
        actionUrl: `/products/${productId}`,
        actionLabel: 'Shop Now',
        data: { productId, productName },
        sendEmail: true,
        priority: 'normal',
      })
    } catch (error) {
      logger.error('Error in onBackInStock:', error)
    }
  }

  /**
   * Trigger when user leaves a review
   */
  static async onReviewSubmitted(userId: string, reviewData: any) {
    try {
      // Notify admins
      const adminResult = await dbQuery(
        `SELECT id FROM users WHERE user_type IN ('admin', 'super_admin') LIMIT 3`,
      )

      for (const admin of adminResult.rows) {
        await NotificationService.create({
          adminId: admin.id,
          type: 'review_submitted',
          title: 'New Product Review',
          message: `New ${reviewData.rating}-star review on ${reviewData.product_name}`,
          data: {
            reviewId: reviewData.id,
            productId: reviewData.product_id,
            userId,
            rating: reviewData.rating,
          },
          priority: 'normal',
        })
      }
    } catch (error) {
      logger.error('Error in onReviewSubmitted:', error)
    }
  }

  /**
   * Trigger for wishlist sale alert
   */
  static async onWishlistItemOnSale(
    userId: string,
    productName: string,
    productId: string,
    salePrice: number,
    originalPrice: number,
  ) {
    try {
      const savings = (
        ((originalPrice - salePrice) / originalPrice) *
        100
      ).toFixed(0)

      await NotificationService.create({
        userId,
        type: 'wishlist_alert',
        title: 'Wishlist Item on Sale!',
        message: `${productName} is now on sale! Save ${savings}%`,
        description: `Now just $${salePrice} (was $${originalPrice})`,
        icon: 'Heart',
        actionUrl: `/products/${productId}`,
        actionLabel: 'Buy Now',
        data: {
          productId,
          productName,
          salePrice,
          originalPrice,
          savingsPercent: savings,
        },
        sendEmail: true,
        priority: 'high',
      })
    } catch (error) {
      logger.error('Error in onWishlistItemOnSale:', error)
    }
  }
}

export default NotificationEvents
