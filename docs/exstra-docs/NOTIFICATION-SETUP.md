# Notification Service - Complete Setup Guide

## Overview

Production-ready notification system for TechTools E-commerce with real-time updates, email, push, and SMS support.

## Database Setup

1. **Run the migration:**

```bash
cd tech-tools-api
npm run migrate
```

This creates:

- `notifications` - User in-app notifications
- `admin_notifications` - Admin dashboard alerts
- `notification_types` - Predefined notification categories
- `notification_templates` - Email/SMS templates
- `notification_delivery_logs` - Delivery tracking

## Backend Setup

### 1. Install Dependencies

```bash
cd tech-tools-api
npm install socket.io socket.io-client
```

### 2. Register Routes in Main API

Add to `src/api/v1/index.ts`:

```typescript
import notificationRoutes from './notifications/notification.routes'
// ...
router.use('/notifications', notificationRoutes)
```

### 3. Initialize WebSocket in Server

In `src/server.ts` or `index.ts`:

```typescript
import NotificationWebSocket from './services/notification.websocket'

const server = createServer(app)
const notificationWS = new NotificationWebSocket(server)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`WebSocket notifications initialized`)
})

// Export for use in controllers
export { notificationWS }
```

### 4. Integrate into Auth Controller (Signup)

```typescript
import NotificationEvents from '../../../services/notification.events'

// After successful user creation in signup endpoint:
await NotificationEvents.onUserSignup(newUser.id, newUser.first_name)
```

### 5. Integrate into Orders Controller

```typescript
import NotificationEvents from '../../../services/notification.events'
import { notificationWS } from '../../../server' // or wherever exported

// After order is created:
await NotificationEvents.onOrderPlaced(userId, createdOrder)

// Real-time update for admins
notificationWS.broadcastToAdmins({
  type: 'new_order',
  orderId: createdOrder.id,
  orderNumber: createdOrder.order_number,
  timestamp: new Date(),
})

// When order status changes:
await NotificationEvents.onOrderStatusChanged(
  userId,
  orderId,
  oldStatus,
  newStatus,
)
```

### 6. Integrate into Contact Controller

```typescript
import NotificationEvents from '../../../services/notification.events'

// After saving contact message:
await NotificationEvents.onContactMessageReceived(contactMessage)
```

### 7. Integrate into Payment Controller

```typescript
import NotificationEvents from '../../../services/notification.events'

// When payment succeeds:
await NotificationEvents.onPaymentReceived(userId, paymentData)

// When payment fails:
await NotificationEvents.onPaymentFailed(userId, paymentData)
```

## Admin Dashboard Setup

### 1. Add Notification Bell to Header

In your main layout component (like `layout.tsx`):

```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell'

export default function DashboardLayout() {
  return (
    <header>
      {/* Other header items */}
      <NotificationBell />
    </header>
  )
}
```

### 2. Create Notifications Page

Create `admin-dashboard/app/(dashboard)/dashboard/notifications/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { Card } from '@/components/ui/card'

export default function NotificationsPage() {
  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/v1/notifications/admin/list', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      return res.json()
    },
  })

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Notifications</h1>

      <Card>
        <div className='divide-y'>
          {notifications?.data?.notifications?.map((notif: any) => (
            <div key={notif.id} className='p-4 hover:bg-slate-50'>
              <h3 className='font-semibold'>{notif.title}</h3>
              <p className='text-sm text-muted-foreground mt-1'>
                {notif.message}
              </p>
              <p className='text-xs text-muted-foreground mt-2'>
                {new Date(notif.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

## Web Store Setup

### 1. Add Notification Toast to Root Layout

```typescript
import { NotificationToast } from '@/components/notifications/NotificationToast'

export default function RootLayout() {
  return (
    <html>
      <body>
        {/* Your app */}
        <NotificationToast />
      </body>
    </html>
  )
}
```

## Mobile App Setup

### 1. Initialize in App.tsx

```typescript
import MobileNotificationService from '@/services/notification.service'

export default function App() {
  useEffect(() => {
    // Initialize push notifications
    MobileNotificationService.init()
  }, [])

  return (
    // Your app
  )
}
```

### 2. Use in Screens

```typescript
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

export function OrdersScreen() {
  const { data } = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: async () => {
      const token = await AsyncStorage.getItem('accessToken')
      const res = await fetch('API_URL/api/v1/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.json()
    }
  })

  return (
    // Show notifications
  )
}
```

## Email Configuration

### 1. Setup Email Templates

Email templates are sent using your existing email service. For customization:

```typescript
// In notification.service.ts, customize the email HTML
const emailContent = `
  <h2>${payload.title}</h2>
  <p>${payload.message}</p>
  <!-- Add your own HTML styling -->
`
```

### 2. Enable Email Sending

```typescript
await NotificationService.create({
  userId,
  type: 'order_placed',
  title: 'Your Order',
  message: 'Order placed successfully',
  sendEmail: true, // Enable email
  sendPush: true, // Enable push
})
```

## Push Notifications (Mobile)

### 1. Firebase Cloud Messaging Setup (Optional)

For production push notifications:

```typescript
// Install: npm install firebase-admin

import admin from 'firebase-admin'

// Initialize in server
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// Send push in NotificationService
const message = {
  notification: {
    title: payload.title,
    body: payload.message,
  },
  data: payload.data,
  token: pushToken,
}

await admin.messaging().send(message)
```

## API Endpoints

### User Notifications

- `GET /api/v1/notifications` - Get user notifications
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/read/all` - Mark all as read
- `PUT /api/v1/notifications/:id/archive` - Archive
- `DELETE /api/v1/notifications/:id` - Delete
- `GET /api/v1/notifications/unread/count` - Get unread count

### Admin Notifications

- `GET /api/v1/notifications/admin/list` - Get admin notifications
- `PUT /api/v1/notifications/admin/:id/read` - Mark as read
- `DELETE /api/v1/notifications/admin/:id` - Delete

## Testing

### 1. Test Manual Notification

```bash
curl -X POST http://localhost:9000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "type": "test",
    "title": "Test Notification",
    "message": "This is a test"
  }'
```

### 2. Test Order Notification

Create an order through the API - should trigger notifications automatically.

## Troubleshooting

### Notifications not appearing

1. Check database: `SELECT COUNT(*) FROM notifications;`
2. Check API logs: `docker logs techtools-api-prod --tail 100`
3. Verify auth token is valid
4. Check browser console for errors

### Email not sending

1. Verify SMTP configuration
2. Check email service credentials in .env
3. Verify recipient email address

### Push not working

1. Check device push token is registered
2. Verify Firebase credentials (if using FCM)
3. Check device notification settings

## Production Deployment

Deploy all changes:

```bash
git add -A
git commit -m "feat: Add production notification service"
git push origin main

# Build and deploy
docker-compose -f infrastructure/docker-compose.prod.yml build
docker-compose -f infrastructure/docker-compose.prod.yml up -d
```

## Summary

Your notification system now includes:
✅ Real-time WebSocket notifications
✅ Email notifications  
✅ Push notifications (mobile)
✅ In-app notification center
✅ Admin dashboard alerts
✅ Automatic event triggers
✅ Notification preferences
✅ Delivery tracking

Just implement the integration points in your controllers and you're ready!
