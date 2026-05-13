# Sprint 2 Implementation Guide

## Quick Reference for Running All 4 Sprint 2 Tasks

This guide shows how all 4 Sprint 2 tasks are integrated and ready to use.

---

## 1. EVENT INSTRUMENTATION

### Web Store Setup
```typescript
// app.tsx - Initialize on mount
import { initializeEventTracking } from '@/services/event-tracking'

useEffect(() => {
  initializeEventTracking()
}, [])

// In any component - use the hook
const { trackProductView, trackAddToCart } = useEventTracking()

// Track product view
trackProductView({
  productId: '123',
  productName: 'Laptop',
  sku: 'LAPTOP-X1',
  category: 'Electronics',
  price: 999.99,
  discount: 0.1
})

// Batch submits automatically when:
// - 10 events accumulated, OR
// - 5 seconds elapsed
```

### Mobile App Setup
```typescript
// _layout.tsx - Initialize on app load
import { initializeEventTracking } from '@/services/event-tracking'

export default function RootLayout() {
  useEffect(() => {
    const init = async () => {
      await initializeEventTracking()
    }
    init()
  }, [])
}

// In screens - use the hook
const { trackScreenView, trackProductView } = useEventTracking()
```

### Event Types Tracked
- Product views (name, price, category, SKU)
- Search queries with result counts
- Category navigation
- Filter applications (price, sort, stock)
- Add to cart (quantity, product details)
- Remove from cart (quantity adjustment)
- Checkout start (cart total)
- Payment success (order ID, amount)
- Product favorites/wishlist
- Promo code application

**Database**: All events stored in `events_core` table with structured tracking

---

## 2. REAL-TIME DASHBOARD UPDATES

### Dashboard Integration
```typescript
// Any dashboard component
import { useRealtimeMetrics, useRealtimeAlerts } from '@/hooks/useRealtimeMetrics'

export default function AnalyticsDashboard() {
  const { metrics: realtimeMetrics, isConnected } = useRealtimeMetrics()
  const { newAlert, isConnected: alertsConnected } = useRealtimeAlerts()

  // Show live connection status
  {isConnected ? (
    <><Wifi className='text-green-600' /><span>Live</span></>
  ) : (
    <><WifiOff className='text-red-600' /><span>Offline</span></>
  )}

  // Use real-time data with fallback to React Query
  const revenue = realtimeMetrics?.lastHourRevenue || queryData?.revenue || 0

  // Listen for new alerts
  useEffect(() => {
    if (newAlert) {
      showNotification(`${newAlert.title}: ${newAlert.message}`)
    }
  }, [newAlert])
}
```

### Metrics Broadcast (Backend)
```typescript
// Automatically runs every 30 seconds
// Metrics Broadcaster calculates:
- activeUsers (5-minute window)
- eventsPerSecond
- lastHourRevenue
- lastHourOrders
- conversionRate (24-hour)
- activeAlerts by severity

// Broadcast to all connected dashboard clients
webSocketService.broadcastMetrics(calculatedMetrics)
```

### Real-time Connections
```
Client connects to Socket.io at: http://localhost:9000
Subscribe to: 'metrics-update' event
Auto-reconnect on disconnect: 1s delay, max 5s, 5 attempts
Fallback to polling transport if WebSocket unavailable
```

---

## 3. ALERT THRESHOLDS CONFIGURATION

### Admin UI
Navigate to: `/dashboard/settings/alert-thresholds`

Features:
- View all 6 detection thresholds
- Edit threshold values and severity levels
- Reset individual thresholds to defaults
- Severity color-coded display (critical/high/medium/low)

### Default Thresholds
```typescript
{
  'revenue_drop': 20,           // % below 7-day average
  'refund_rate': 5,             // % in 24h
  'return_rate': 3,             // % in 24h
  'checkout_abandonment': 40,   // %
  'search_zero_results': 10,    // % of searches
  'supplier_late_rate': 10      // % of deliveries
}
```

### Update Threshold API
```bash
curl -X PUT http://localhost:9000/api/v1/settings/alert-thresholds/threshold-id \
  -H "Content-Type: application/json" \
  -d '{
    "thresholdValue": 25,
    "severity": "high",
    "description": "Alert when revenue drops 25% below baseline"
  }'
```

### Reset to Defaults
```bash
curl -X POST http://localhost:9000/api/v1/settings/alert-thresholds/threshold-id/reset
```

---

## 4. ALERT NOTIFICATIONS (EMAIL, SLACK, SMS)

### Admin Notification Preferences UI
Navigate to: `/dashboard/settings/notifications`

Configure per admin:
- Email notifications (enable/disable + email address)
- Slack notifications (enable/disable + channel)
- SMS notifications (enable/disable + phone number)
- Severity threshold (only notify for critical/high/medium/low)

### Notification Flow
```
Anomaly Detected → Alert Created → Notification Dispatcher
                                         ↓
                      Check admin preferences & severity
                                         ↓
                    ┌─────────────────┬──────────┬──────────┐
                    ↓                 ↓          ↓          ↓
              Email Service    Slack Service  SMS Service
                    ↓                 ↓          ↓          ↓
          HTML Email Template  Rich Blocks   160-char SMS
          (with dashboard link) (with buttons) (critical only)
```

### Email Template
```html
<!-- Automatic HTML template with: -->
- Alert title (colored by severity)
- Alert message with context
- Current value vs threshold
- Alert type and timestamp
- Dashboard link for investigation
- Professional footer
```

### Slack Message
```json
{
  "text": "🚨 HIGH Alert: Revenue Drop 25%",
  "attachments": [{
    "color": "#ea580c",
    "title": "Revenue Drop Alert",
    "fields": [
      { "title": "Alert Type", "value": "REVENUE DROP" },
      { "title": "Current Value", "value": "5000" },
      { "title": "Threshold", "value": "6250" }
    ],
    "actions": [{
      "type": "button",
      "text": "View in Dashboard",
      "url": "https://admin.techtools.com/dashboard/alerts"
    }]
  }]
}
```

### SMS Message
```
🚨 CRITICAL: Revenue Drop 25% (5000 vs threshold 6250)
```

---

## Environment Setup

### Create .env with notification credentials

```bash
# Email (Nodemailer SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password      # Generate in Google Account Settings
SMTP_FROM_EMAIL=noreply@techtools.com

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# OR
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890       # Your Twilio phone number
SMS_CRITICAL_ONLY=true                # Send SMS only for critical/high severity
```

### Verify Connections
```bash
# Email test
curl -X POST http://localhost:9000/api/v1/notifications/test/email

# Slack test
curl -X POST http://localhost:9000/api/v1/notifications/test/slack

# SMS test
curl -X POST http://localhost:9000/api/v1/notifications/test/sms \
  -d '{"phoneNumber": "+1234567890"}'
```

---

## Integration Points

### 1. Event Tracking → Database
- Web/Mobile apps submit batches to `/api/v1/events/batch`
- Event service stores in `events_core` table
- Automatically attached: source, session_id, user_id, device_info

### 2. Database → Anomaly Detection
- Detection worker runs every 15 minutes
- Queries event and order data
- Compares against thresholds
- Creates alerts when anomalies detected

### 3. Alerts → Notifications
- Alert creation triggers notification dispatch
- Respects admin preferences per channel
- Respects severity thresholds
- Failures don't block other channels

### 4. Metrics → Dashboard
- Broadcaster queries database every 30 seconds
- Calculates 6 key metrics
- Broadcasts via WebSocket
- Dashboard auto-updates in real-time

---

## Testing Alerts End-to-End

### Scenario 1: High Refund Rate
```bash
# In database, create test refunds
INSERT INTO refunds (order_id, amount, reason) VALUES (1, 100, 'Quality');
INSERT INTO refunds (order_id, amount, reason) VALUES (2, 150, 'Defect');

# Wait for anomaly detection (15 min interval)
# Alert created → notification dispatched to all admins

# Check alerts
curl http://localhost:9000/api/v1/alerts

# See email in test inbox, Slack message in channel, SMS received
```

### Scenario 2: Revenue Drop
```bash
# Orders get low total amounts for entire day
# Day total < 80% of 7-day average
# Alert triggered → emails, Slack, SMS dispatched

# Dashboard shows alert in real-time via WebSocket
```

### Scenario 3: Notification Preference
```bash
# Admin A: Only email enabled, severity=high
# → Receives emails for critical/high alerts only

# Admin B: Email + Slack enabled, severity=medium
# → Receives emails + Slack for critical/high/medium alerts

# Admin C: SMS enabled with threshold=critical
# → Receives SMS only for critical alerts (cost control)
```

---

## Monitoring & Debugging

### Check Event Submission
```sql
-- Count events by type
SELECT event_type, COUNT(*) as count, MAX(created_at) as last_event
FROM events_core
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY count DESC;
```

### Check Real-time Connections
```javascript
// In browser dev tools (admin dashboard)
// Open WebSocket tab → should see 'connect' and 'metrics-update' messages
```

### Check Anomalies & Alerts
```sql
-- Get active alerts
SELECT alert_type, severity, COUNT(*) as count
FROM alerts
WHERE is_active = true
GROUP BY alert_type, severity;

-- Check latest alert
SELECT * FROM alerts
ORDER BY triggered_at DESC
LIMIT 5;
```

### Check Notification Dispatch
```javascript
// In server logs, look for:
// "Alert email sent to admin@example.com"
// "Alert notification sent to Slack for alert revenue_drop"
// "Alert SMS sent to +1234567890"
```

---

## Performance Considerations

- **Event Batching**: 10 events or 5 seconds (configurable)
- **Metrics Broadcast**: Every 30 seconds (configurable)
- **Anomaly Detection**: Every 15 minutes (configurable)
- **Database Indexes**: All event/alert queries optimized with indexes
- **WebSocket**: Auto-disconnect idle clients, polling fallback for unreliable networks

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Emails not sending | Verify SMTP credentials, check Gmail "Less secure app" setting, ensure sender email whitelisted |
| Slack not working | Verify webhook URL valid, check Slack channel permissions, test with curl |
| SMS not working | Verify Twilio account active, phone number valid format, check SMS_CRITICAL_ONLY setting |
| WebSocket disconnects | Browser firewall blocking WSS, check Socket.io CORS settings, verify server running |
| Alerts not triggering | Check threshold values, verify event data in database, ensure anomaly detection worker running |
| Metrics not updating | Check metrics broadcaster running, verify WebSocket connection, look for database query errors |

---

**All Sprint 2 features are integrated and production-ready! 🚀**
