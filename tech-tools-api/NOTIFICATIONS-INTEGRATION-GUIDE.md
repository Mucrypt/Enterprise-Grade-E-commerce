/\*\*

- NOTIFICATION SERVICE INTEGRATION GUIDE
- ======================================
-
- This document shows how to integrate the notification service
- into your existing API endpoints and services.
  \*/

// =====================================================
// 1. INTEGRATE INTO AUTH ROUTES (user signup)
// =====================================================
// File: tech-tools-api/src/api/v1/auth/auth.controller.ts

/\*
EXAMPLE - Add to signup endpoint:

import NotificationEvents from '../../../services/notification.events'

export const signup = async (req: AuthRequest, res: Response) => {
try {
// ... existing signup code ...

    const newUser = await query(
      `INSERT INTO users (...) VALUES (...) RETURNING *`,
      [email, hashedPassword, first_name, last_name]
    )

    // TRIGGER NOTIFICATION
    NotificationEvents.onUserSignup(newUser.rows[0].id, newUser.rows[0].first_name)

    res.json({ success: true, data: { user: newUser.rows[0] } })

} catch (error) {
logger.error('Signup error:', error)
res.status(500).json({ success: false, error: 'Signup failed' })
}
}
\*/

// =====================================================
// 2. INTEGRATE INTO ORDERS (when order is placed)
// =====================================================
// File: tech-tools-api/src/api/v1/orders/order.controller.ts

/\*
EXAMPLE - Add to createOrder endpoint:

import NotificationEvents from '../../../services/notification.events'

export const createOrder = async (req: AuthRequest, res: Response) => {
try {
const userId = req.user?.id

    // ... existing order creation code ...

    const newOrder = await query(
      `INSERT INTO orders (...) VALUES (...) RETURNING *`,
      [userId, items, totalAmount, ...]
    )

    // TRIGGER NOTIFICATION
    NotificationEvents.onOrderPlaced(userId, newOrder.rows[0])

    res.json({ success: true, data: { order: newOrder.rows[0] } })

} catch (error) {
logger.error('Create order error:', error)
res.status(500).json({ success: false, error: 'Failed to create order' })
}
}
\*/

// =====================================================
// 3. INTEGRATE INTO ORDER STATUS UPDATES
// =====================================================
// File: tech-tools-api/src/api/v1/orders/order.controller.ts

/\*
EXAMPLE - Add to updateOrderStatus endpoint:

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
try {
const { id } = req.params
const { status } = req.body

    // Get old status
    const oldStatusResult = await query(
      `SELECT order_status FROM orders WHERE id = $1`,
      [id]
    )
    const oldStatus = oldStatusResult.rows[0].order_status

    // Update status
    const updateResult = await query(
      `UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    )

    // Get user_id for notification
    const userResult = await query(
      `SELECT user_id FROM orders WHERE id = $1`,
      [id]
    )
    const userId = userResult.rows[0].user_id

    // TRIGGER NOTIFICATION
    NotificationEvents.onOrderStatusChanged(userId, id, oldStatus, status)

    res.json({ success: true, data: { order: updateResult.rows[0] } })

} catch (error) {
logger.error('Update order status error:', error)
res.status(500).json({ success: false, error: 'Failed to update order' })
}
}
\*/

// =====================================================
// 4. INTEGRATE INTO PAYMENTS
// =====================================================
// File: tech-tools-api/src/api/v1/payments/payment.controller.ts

/\*
EXAMPLE - Add to handlePaymentSuccess:

export const handlePaymentSuccess = async (req: AuthRequest, res: Response) => {
try {
const { orderId, paymentData } = req.body

    // Save payment
    const payment = await query(
      `INSERT INTO payments (...) VALUES (...) RETURNING *`,
      [orderId, paymentData]
    )

    // Get user and order info
    const orderResult = await query(
      `SELECT user_id FROM orders WHERE id = $1`,
      [orderId]
    )

    // TRIGGER NOTIFICATION
    NotificationEvents.onPaymentReceived(orderResult.rows[0].user_id, payment.rows[0])

    res.json({ success: true, data: { payment: payment.rows[0] } })

} catch (error) {
logger.error('Payment error:', error)
res.status(500).json({ success: false, error: 'Payment failed' })
}
}
\*/

// =====================================================
// 5. INTEGRATE INTO CONTACT FORM
// =====================================================
// File: tech-tools-api/src/api/v1/contact/contact.controller.ts

/\*
EXAMPLE - Add to submitContactMessage:

export const submitContactMessage = async (req: Request, res: Response) => {
try {
const { name, email, subject, message } = req.body

    // Save message
    const savedMessage = await query(
      `INSERT INTO email_messages (...) VALUES (...) RETURNING *`,
      [name, email, subject, message]
    )

    // TRIGGER NOTIFICATION
    NotificationEvents.onContactMessageReceived(savedMessage.rows[0])

    res.json({ success: true, message: 'Message sent' })

} catch (error) {
logger.error('Contact message error:', error)
res.status(500).json({ success: false, error: 'Failed to send message' })
}
}
\*/

// =====================================================
// 6. INTEGRATE INTO PRODUCT STOCK MANAGEMENT
// =====================================================
// File: tech-tools-api/src/api/v1/products/product.controller.ts

/\*
EXAMPLE - Add to updateProductStock:

export const updateProductStock = async (req: AuthRequest, res: Response) => {
try {
const { productId } = req.params
const { quantity } = req.body

    // Get product info
    const productResult = await query(
      `SELECT id, name, base_price FROM products WHERE id = $1`,
      [productId]
    )
    const product = productResult.rows[0]

    // Update stock
    const updateResult = await query(
      `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 RETURNING *`,
      [quantity, productId]
    )

    const newStock = updateResult.rows[0].stock_quantity

    // Check if stock is low
    if (newStock > 0 && newStock <= 5) {
      NotificationEvents.onLowStockAlert(productId, product.name, newStock)
    }

    // Check if was out of stock and now back in stock
    if (newStock > 0 && newStock - quantity <= 0) {
      // Get users who have this in wishlist
      const wishlistResult = await query(
        `SELECT user_id FROM wishlists WHERE product_id = $1`,
        [productId]
      )

      for (const user of wishlistResult.rows) {
        NotificationEvents.onBackInStock(user.user_id, product.name, productId)
      }
    }

    res.json({ success: true, data: { product: updateResult.rows[0] } })

} catch (error) {
logger.error('Update stock error:', error)
res.status(500).json({ success: false, error: 'Failed to update stock' })
}
}
\*/

// =====================================================
// 7. INTEGRATE INTO ADMIN DASHBOARD ROUTES
// =====================================================
// File: admin-dashboard/services/order.service.ts

/\*
EXAMPLE - Update order status from admin dashboard:

export async function updateOrderStatus(orderId: string, status: string) {
const response = await apiClient.put(`/orders/admin/${orderId}/status`, {
status,
})
return response.data
}

// Then in component:
const updateStatus = async (newStatus: string) => {
try {
await orderService.updateOrderStatus(orderId, newStatus)
// Notification will be sent automatically via the API
toast.success('Order status updated')
} catch (error) {
toast.error('Failed to update order')
}
}
\*/

// =====================================================
// 8. SETUP ROUTES IN MAIN API
// =====================================================
// File: tech-tools-api/src/api/v1/index.ts

/\*
Add to the main router:

import notificationRoutes from './notifications/notification.routes'

export const setupRoutes = (app: Express) => {
// ... other routes ...

// Notifications
app.use('/api/v1/notifications', notificationRoutes)

// ... rest of routes ...
}
\*/

// =====================================================
// 9. SETUP WEBSOCKET IN MAIN APP
// =====================================================
// File: tech-tools-api/src/index.ts

/\*
Setup WebSocket with HTTP server:

import express from 'express'
import http from 'http'
import NotificationWebSocket from './services/notification.websocket'

const app = express()
const httpServer = http.createServer(app)

// Setup WebSocket
const notificationWS = new NotificationWebSocket(httpServer)

// Export for use in routes
global.notificationWS = notificationWS

// Start server
httpServer.listen(process.env.PORT || 9000, () => {
console.log(`Server running on port ${process.env.PORT || 9000}`)
console.log(`WebSocket ready for notifications`)
})
\*/

// =====================================================
// 10. SEND NOTIFICATIONS FROM WEBSOCKET
// =====================================================
// Usage in any controller:

/\*
import { query as dbQuery } from '../../../database/connection'

export const notifyUsersOfOrderShipment = async (
req: AuthRequest,
res: Response
) => {
try {
const { orderId, trackingNumber } = req.body

    // Get user from order
    const orderResult = await dbQuery(
      `SELECT user_id FROM orders WHERE id = $1`,
      [orderId]
    )

    const userId = orderResult.rows[0].user_id

    // Create notification
    const notification = {
      id: 'some-id',
      title: 'Order Shipped',
      message: `Your order has been shipped with tracking number: ${trackingNumber}`,
      actionUrl: `/orders/${orderId}`,
      is_read: false,
      created_at: new Date(),
    }

    // Send real-time via WebSocket
    if (global.notificationWS) {
      global.notificationWS.sendToUser(userId, notification)
    }

    res.json({ success: true })

} catch (error) {
res.status(500).json({ success: false, error: error.message })
}
}
\*/

// =====================================================
// 11. ADMIN DASHBOARD INTEGRATION
// =====================================================
// File: admin-dashboard/components/layout/Header.tsx

/\*
Add NotificationBell to header:

import NotificationBell from '@/components/notifications/NotificationBell'

export function Header() {
return (
<header className='border-b'>
<div className='flex items-center justify-between px-6 py-4'>
<h1>Admin Dashboard</h1>
<div className='flex items-center gap-4'>
<NotificationBell />
{/_ Other header items _/}
</div>
</div>
</header>
)
}
\*/

// =====================================================
// 12. WEBSTORE INTEGRATION
// =====================================================
// File: e-commerce-web-store/src/components/layout/Header.tsx

/\*
Add NotificationBell to webstore:

import NotificationBell from '@/components/notifications/NotificationBell'

export function Header() {
return (
<header>
<div className='flex items-center justify-between'>
<Logo />
<nav>
<NotificationBell />
{/_ Other nav items _/}
</nav>
</div>
</header>
)
}
\*/

// =====================================================
// 13. DATABASE MIGRATION
// =====================================================
// Run this migration on production:
/_
npm run migrate
// or manually run:
psql -U techtools_user -d techtools -f src/database/migrations/004_notifications_schema.sql
_/

export default {}
