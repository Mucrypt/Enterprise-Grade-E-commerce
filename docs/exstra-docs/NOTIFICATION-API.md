# Notification API Documentation

## Base URL

```
http://localhost:9000/api/v1/notifications
```

## Authentication

All endpoints require bearer token:

```
Authorization: Bearer {accessToken}
```

---

## User Notification Endpoints

### 1. Get User Notifications

Retrieve all notifications for the authenticated user.

**Endpoint:** `GET /notifications`

**Query Parameters:**

- `limit` (number, optional): Default 50
- `offset` (number, optional): Default 0
- `unreadOnly` (boolean, optional): Show only unread

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications?limit=20&unreadOnly=true"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "Order Placed Successfully",
        "message": "Your order TT-123456 has been placed",
        "description": "Order Total: $45.94",
        "icon": "ShoppingCart",
        "is_read": false,
        "created_at": "2026-04-13T10:30:00Z",
        "actionUrl": "/orders/order-id",
        "actionLabel": "View Order",
        "data": {
          "orderId": "order-id",
          "orderNumber": "TT-123456"
        }
      }
    ],
    "unreadCount": 5,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 2. Get Unread Count

Get the number of unread notifications.

**Endpoint:** `GET /notifications/unread/count`

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications/unread/count"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

---

### 3. Mark Notification as Read

Mark a single notification as read.

**Endpoint:** `PUT /notifications/:id/read`

**Path Parameters:**

- `id` (string): Notification UUID

**Example:**

```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications/abc-123/read"
```

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 4. Mark All Notifications as Read

Mark all unread notifications as read.

**Endpoint:** `PUT /notifications/read/all`

**Example:**

```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications/read/all"
```

**Response:**

```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

### 5. Archive Notification

Archive a notification (hide from list but don't delete).

**Endpoint:** `PUT /notifications/:id/archive`

**Example:**

```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications/abc-123/archive"
```

**Response:**

```json
{
  "success": true,
  "message": "Notification archived"
}
```

---

### 6. Delete Notification

Permanently delete a notification.

**Endpoint:** `DELETE /notifications/:id`

**Example:**

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9000/api/v1/notifications/abc-123"
```

**Response:**

```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## Admin Notification Endpoints

### 1. Get Admin Notifications

Retrieve all notifications for the logged-in admin.

**Endpoint:** `GET /notifications/admin/list`

**Query Parameters:**

- `limit` (number, optional): Default 50
- `offset` (number, optional): Default 0
- `unreadOnly` (boolean, optional): Show only unread
- `type` (string, optional): Filter by notification type

**Example:**

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:9000/api/v1/notifications/admin/list?type=order_placed"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "notification_type": "order_placed",
        "title": "New Order Received",
        "message": "John Doe placed order TT-123456 for $45.94",
        "is_read": false,
        "created_at": "2026-04-13T10:30:00Z",
        "data": {
          "orderId": "order-id",
          "orderNumber": "TT-123456",
          "customerName": "John Doe",
          "userId": "user-id"
        },
        "priority": "high"
      }
    ],
    "unreadCount": 12,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2. Mark Admin Notification as Read

Mark an admin notification as read.

**Endpoint:** `PUT /notifications/admin/:id/read`

**Example:**

```bash
curl -X PUT \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:9000/api/v1/notifications/admin/abc-123/read"
```

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 3. Delete Admin Notification

Delete an admin notification.

**Endpoint:** `DELETE /notifications/admin/:id`

**Example:**

```bash
curl -X DELETE \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:9000/api/v1/notifications/admin/abc-123"
```

**Response:**

```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## WebSocket Events (Real-time)

Connect to WebSocket with token:

```javascript
const socket = io('http://localhost:9000', {
  auth: {
    token: localStorage.getItem('accessToken'),
    user: { id: 'user-id', role: 'admin' },
  },
})

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification)
})

// Listen for admin alerts
socket.on('admin:alert', (alert) => {
  console.log('Admin alert:', alert)
})

// Listen for unread count updates
socket.on('notification:unreadCount', (count) => {
  console.log('Unread count:', count)
})
```

---

## Notification Types

Common notification types sent by the system:

| Type               | Description                 | Priority |
| ------------------ | --------------------------- | -------- |
| `order_placed`     | New order created           | high     |
| `order_confirmed`  | Order confirmed             | normal   |
| `order_processing` | Order being prepared        | normal   |
| `order_shipped`    | Order shipped               | normal   |
| `order_delivered`  | Order delivered             | normal   |
| `order_cancelled`  | Order cancelled             | normal   |
| `payment_received` | Payment successful          | high     |
| `payment_failed`   | Payment failed              | high     |
| `user_signup`      | New user registered         | normal   |
| `contact_message`  | New contact form submission | high     |
| `low_stock`        | Product low on stock        | normal   |
| `back_in_stock`    | Product back in stock       | normal   |
| `review_submitted` | New product review          | normal   |
| `account_verified` | Account verified            | normal   |
| `password_reset`   | Password reset              | normal   |

---

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Notification not found"
}
```

### 500 Server Error

```json
{
  "success": false,
  "error": "Failed to fetch notifications"
}
```

---

## Usage Examples

### JavaScript/React

```typescript
// Fetch notifications
const response = await fetch('/api/v1/notifications?limit=10', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
const data = await response.json()

// Mark as read
await fetch(`/api/v1/notifications/${notificationId}/read`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})

// Listen for real-time updates
import { io } from 'socket.io-client'

const socket = io('http://localhost:9000', {
  auth: { token: accessToken, user: { id: userId, role: userRole } },
})

socket.on('notification', (notification) => {
  // Update UI with new notification
})
```

### cURL Examples

```bash
# Get notifications
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications

# Mark as read
curl -X PUT -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications/ID/read

# Get unread count
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications/unread/count
```

---

## Rate Limiting

- No specific rate limit on notification endpoints
- General API rate limiting applies (if configured)

---

## Pagination

Use `limit` and `offset` for pagination:

```
GET /notifications?limit=20&offset=0  # First page
GET /notifications?limit=20&offset=20 # Second page
GET /notifications?limit=20&offset=40 # Third page
```
