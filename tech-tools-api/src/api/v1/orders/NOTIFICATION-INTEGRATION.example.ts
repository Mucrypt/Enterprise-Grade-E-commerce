/**
 * ORDERS CONTROLLER INTEGRATION - Add to your existing order.controller.ts
 *
 * This shows where to add notification triggers in your order flow
 */

// Add these imports at the top of your orders.controller.ts
import NotificationEvents from '../../../services/notification.events'

/**
 * EXAMPLE: After order is successfully created
 *
 * In your createOrder endpoint, after creating the order, add:
 */
export const orderPlacedNotificationExample = async (
  userId: string,
  orderData: {
    id: string
    order_number: string
    grand_total: number
    estimated_delivery_date?: string
  },
) => {
  try {
    // Send notifications to user and admins
    await NotificationEvents.onOrderPlaced(userId, orderData)
    console.log('Order notifications sent for order:', orderData.order_number)
  } catch (error) {
    console.error('Error sending order notifications:', error)
    // Don't throw - notification failure shouldn't block order creation
  }
}

/**
 * EXAMPLE: When order status is updated
 *
 * In your updateOrderStatus endpoint, after updating status, add:
 */
export const orderStatusChangeNotificationExample = async (
  userId: string,
  orderId: string,
  oldStatus: string,
  newStatus: string,
  trackingNumber?: string,
) => {
  try {
    await NotificationEvents.onOrderStatusChanged(
      userId,
      orderId,
      oldStatus,
      newStatus,
    )

    // Optional: If shipped, include tracking info
    if (newStatus === 'shipped' && trackingNumber) {
      const { NotificationService } = await import(
        '../../../services/notification.service'
      )

      const user = await query('SELECT email FROM users WHERE id = $1', [
        userId,
      ])

      await NotificationService.create({
        userId,
        type: 'order_shipped',
        title: 'Order Shipped',
        message: `Your order has been shipped! Tracking: ${trackingNumber}`,
        icon: 'Truck',
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'Track Order',
        data: {
          orderId,
          trackingNumber,
          carrier: 'FedEx', // Or whatever carrier
        },
        sendEmail: true,
        priority: 'normal',
      })
    }

    console.log(`Order status changed: ${oldStatus} -> ${newStatus}`)
  } catch (error) {
    console.error('Error sending status change notification:', error)
  }
}

/**
 * EXAMPLE: When order is delivered
 */
export const orderDeliveredNotificationExample = async (
  userId: string,
  orderId: string,
) => {
  try {
    const { NotificationService } = await import(
      '../../../services/notification.service'
    )

    await NotificationService.create({
      userId,
      type: 'order_delivered',
      title: 'Order Delivered!',
      message: 'Your order has been delivered. Thank you for your purchase!',
      description: 'Please leave a review to help other customers.',
      icon: 'Gift',
      actionUrl: `/orders/${orderId}/review`,
      actionLabel: 'Leave Review',
      data: { orderId },
      sendEmail: true,
      priority: 'normal',
    })
  } catch (error) {
    console.error('Error sending delivery notification:', error)
  }
}

/**
 * EXAMPLE: When order is cancelled
 */
export const orderCancelledNotificationExample = async (
  userId: string,
  orderId: string,
  reason: string = 'Customer requested cancellation',
) => {
  try {
    const { NotificationService } = await import(
      '../../../services/notification.service'
    )

    await NotificationService.create({
      userId,
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message:
        'Your order has been cancelled. A refund will be processed shortly.',
      description: reason,
      icon: 'XCircle',
      actionUrl: `/orders/${orderId}`,
      actionLabel: 'View Order',
      data: { orderId, reason },
      sendEmail: true,
      priority: 'high',
    })
  } catch (error) {
    console.error('Error sending cancellation notification:', error)
  }
}
