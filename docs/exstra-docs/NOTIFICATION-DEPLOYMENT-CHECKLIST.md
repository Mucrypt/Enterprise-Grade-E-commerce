# Notification Service - Deployment & Testing Checklist

## Pre-deployment Checklist

### Database

- [ ] Run migration: `npm run migrate`
- [ ] Verify tables created:
  - [ ] notifications
  - [ ] admin_notifications
  - [ ] notification_types
  - [ ] notification_templates
  - [ ] notification_delivery_logs
- [ ] Check indexes created
- [ ] Verify default notification types inserted

### Backend Configuration

- [ ] Install Socket.io: `npm install socket.io`
- [ ] Add notification routes to API
- [ ] Initialize WebSocket in server
- [ ] Configure CORS for WebSocket
- [ ] Export notificationWS from server

### Environment Variables

```bash
# Add to .env file
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
SMTP_SECURE=false

# Optional: Firebase for push notifications
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=your-key
FIREBASE_CLIENT_EMAIL=your-email
```

### Email Setup

- [ ] Verify SMTP credentials work
- [ ] Test email sending
- [ ] Customize email templates

### Frontend Dependencies

Admin Dashboard:

```bash
npm install react-query sonner lucide-react date-fns
```

Web Store:

```bash
npm install react-query sonner date-fns
```

Mobile App:

```bash
npm install expo-notifications expo-device firebase-admin
```

---

## Integration Testing

### 1. Test User Signup Notification

```bash
# Steps:
1. Create new user account
2. Check database: SELECT COUNT(*) FROM notifications WHERE type_id like '%user_signup%'
3. Check email (if SMTP configured)
4. Verify admin notification created
5. Check admin dashboard bell shows notification
```

**Expected Result:**

- User receives welcome notification
- Admins receive signup alert
- Email sent successfully

### 2. Test Order Notification

```bash
# Steps:
1. Create new order (via API or webstore)
2. Check notifications table for order_placed entries
3. Verify email sent to customer
4. Verify admin notification created
5. Check admin dashboard real-time update
```

**Expected Result:**

- User sees order confirmation
- Admin sees new order alert in real-time
- Both receive emails

### 3. Test Order Status Change

```bash
# Steps:
1. Create order
2. Update order status to 'shipped'
3. Check notification created
4. Verify email sent with status info
5. Test on mobile app (if push enabled)
```

**Expected Result:**

- Notification appears in user's list
- User receives email/push notification
- Unread count updates

### 4. Test Contact Message

```bash
# Steps:
1. Submit contact form on web store
2. Check admin notifications in dashboard
3. Verify admin receives notification alert
4. Test different contact types (support, sales, billing)
```

**Expected Result:**

- Admin sees notification immediately in dashboard
- Notification marked with high priority
- Routing to correct admin email

### 5. Test Unread Count

```bash
# API:
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications/unread/count

# Expected:
{"success": true, "data": {"unreadCount": 3}}
```

### 6. Test Mark as Read

```bash
# API:
curl -X PUT -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications/{id}/read

# Verify:
- unreadCount decreases by 1
- UI updates notification as read
- Badge count updates
```

---

## UI Testing

### Admin Dashboard

- [ ] Notification bell appears in header
- [ ] Bell shows red badge with unread count
- [ ] Click bell opens dropdown with notifications
- [ ] Notifications sorted by newest first
- [ ] Mark as read works
- [ ] Archive works
- [ ] Delete works
- [ ] Click notification navigates to relevant page
- [ ] New notifications appear in real-time

### Web Store

- [ ] Toast notification appears for order placed
- [ ] Toast auto-hides after 5 seconds
- [ ] User can click toast to view order
- [ ] Close button works

### Mobile App

- [ ] Push notifications appear when app in background
- [ ] Tap notification navigates to correct screen
- [ ] Notification list shows all notifications
- [ ] Unread badge appears on icon

---

## Performance Testing

### Database Queries

```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM notifications
WHERE user_id = 'user-id' AND is_archived = FALSE
ORDER BY created_at DESC LIMIT 50;

-- Should use index: idx_notifications_user_read_created
```

### Load Test

Send 1000 notifications simultaneously:

```bash
# Use Apache Bench or similar
ab -n 1000 -c 50 http://localhost:9000/api/v1/notifications
```

Expected: < 100ms response time

### WebSocket Connections

- [ ] Test 100+ concurrent WebSocket connections
- [ ] Verify message delivery to all connected clients
- [ ] Check memory usage stays stable

---

## Production Deployment

### Building Docker Images

```bash
# Build API with notification support
docker build -t techtools-api:latest -f Dockerfile .

# Deploy
docker-compose -f infrastructure/docker-compose.prod.yml up -d
```

### Database Migration

```bash
# On production server
docker exec techtools-api npm run migrate
```

### Post-deployment Verification

```bash
# Check migrations ran
docker exec -it techtools-postgres-prod psql -U techtools_user -d techtools -c \
  "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = 'public'"

# Verify migration files
SELECT * FROM _prisma_migrations;

# Check notification types
SELECT COUNT(*) FROM notification_types;
```

### Monitor Logs

```bash
# Watch API logs
docker logs techtools-api-prod -f

# Check for errors
docker logs techtools-api-prod | grep -i error

# Monitor WebSocket connections
docker logs techtools-api-prod | grep socket
```

---

## Troubleshooting

### Notifications Not Appearing

```bash
# 1. Check database
docker exec -it techtools-postgres-prod psql -U techtools_user -d techtools -c \
  "SELECT COUNT(*) FROM notifications;"

# 2. Check API logs
docker logs techtools-api-prod --tail 100

# 3. Verify token is valid
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:9000/api/v1/notifications

# 4. Check WebSocket connection
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:9000/socket.io/?token=TOKEN
```

### Email Not Sending

```bash
# 1. Test SMTP connection
telnet smtp.your-host.com 587

# 2. Check .env SMTP settings
docker exec techtools-api-prod env | grep SMTP

# 3. Check email service logs
docker logs techtools-api-prod | grep -i email
```

### WebSocket Connection Fails

```bash
# 1. Verify auth middleware
# 2. Check CORS configuration
# 3. Verify token in auth header
# 4. Check firewall allows WebSocket
```

---

## Success Criteria

✅ All notification types trigger correctly
✅ Email sends within 2 seconds
✅ Push notifications deliver to mobile
✅ WebSocket real-time updates work
✅ Admin dashboard shows notifications immediately
✅ Unread count accurate
✅ Mark as read/archive/delete work
✅ Performance acceptable under load
✅ No errors in logs
✅ Database queries optimized with indexes

---

## Implementation Summary

### Files Created

- [x] Database schema migration
- [x] Notification service (core logic)
- [x] Notification event handlers
- [x] WebSocket integration
- [x] API routes & controllers
- [x] Admin dashboard components
- [x] Web store toast component
- [x] Mobile app notification service
- [x] Integration examples (auth, orders, contact, payments)
- [x] Setup documentation
- [x] API documentation
- [x] Deployment checklist

### Ready to Deploy

1. Copy all files to your repo
2. Run database migration
3. Install dependencies
4. Add notification triggers to existing controllers
5. Configure email/SMS (optional)
6. Deploy to production
7. Run tests from this checklist
8. Monitor logs for issues

### Estimated Setup Time

- Backend integration: 1-2 hours
- Admin dashboard: 30 minutes
- Testing: 1 hour
- Total: 2.5-3.5 hours

### Next Steps (Optional Enhancements)

- [ ] Implement Firebase Cloud Messaging for push
- [ ] Add SMS notifications via Twilio
- [ ] Create notification scheduling
- [ ] Add notification templates editing UI
- [ ] Implement notification analytics dashboard
- [ ] Add bulk notification sending for campaigns
