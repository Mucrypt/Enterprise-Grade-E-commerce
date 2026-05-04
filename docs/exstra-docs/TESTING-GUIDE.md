# Testing Guide: Chat Widget & Shipping Integration

**Date:** April 14, 2026  
**Status:** Ready to test after deployment

---

## 🔴 IMPORTANT: Why Chat Widget Isn't Showing

The Drift chat widget won't appear until you configure your Drift App ID. Here's why:

### Current Setup with Placeholder ID:

```typescript
// admin-dashboard/components/DriftChat.tsx
window.drift.load('APPLICATION_ID') // ← This is just a placeholder!

// Same in: e-commerce-web-store/src/components/layout/DriftChat.tsx
```

**The widget only loads when you use a REAL Drift ID.**

---

## ✅ PART 1: Configure Drift Chat (5 Minutes)

### Step 1: Get Your Drift App ID

1. Go to: https://drift.com
2. Click "Sign up for free"
3. Create account (takes 2 minutes)
4. After login, go to: https://dash.driftt.com/settings/installation
5. Look for **"App ID"** or **"Embed ID"**
6. Copy the ID (looks like: `abc123xyz`)

### Step 2: Update Drift ID in Code

**File 1:** `admin-dashboard/components/DriftChat.tsx`

```bash
nano admin-dashboard/components/DriftChat.tsx
```

Find this line:

```typescript
window.drift.load('APPLICATION_ID')
```

Replace `APPLICATION_ID` with your real ID:

```typescript
window.drift.load('abc123xyz') // ← Your actual Drift ID
```

**File 2:** `e-commerce-web-store/src/components/layout/DriftChat.tsx`

```bash
nano e-commerce-web-store/src/components/layout/DriftChat.tsx
```

Do the same replacement.

### Step 3: Rebuild & Deploy

```bash
cd /home/mukulah/Enterprise-Grade-E-commerce
git add -A
git commit -m "Configure Drift chat with real App ID"
./server-scripts/rebuild.sh
```

Monitor:

```bash
docker compose logs -f api
```

Wait for: ✅ "Server running on port 3001"

### Step 4: Test Chat Widget

1. **Web Store:** https://yourdomain.com
2. **Scroll to bottom right** → Should see Drift chat widget ✅
3. Click it → Chat window opens
4. Try sending a message: "Test message"
5. Go to: https://dash.driftt.com/conversations
6. You should see your test message there ✅

---

## ✅ PART 2: Test Shipping Integration

### Option A: Test via Web Store (Easiest)

#### Step 1: Place Guest Order

1. Go to: https://yourdomain.com/checkout
2. Click **"Guest Checkout"** button
3. Fill in form:
   - Email: test@example.com
   - First Name: John
   - Last Name: Doe
   - Address: 123 Main Street
   - City: Berlin
   - State: Berlin
   - Postal Code: 10115
   - Country: Germany
4. Click **"Continue"** → Payment step
5. Use Stripe test card: `4242 4242 4242 4242` (Exp: 12/34, CVC: 123)
6. Click **"Pay"** → Order confirmed ✅

#### Step 2: Check Shipping Rates

Go to **Admin Dashboard** → `/dashboard/orders`

Find your test order → Click "Create Shipment"

You should see:

```
📦 Available Carriers:
  ☐ FedEx - €15.99 (3-5 days)
  ☐ UPS - €12.99 (2-3 days)
  ☐ DHL - €10.99 (1-2 days)
```

**If you see this → Shipping is working!** ✅

---

### Option B: Test via API (Advanced)

#### Test 1: Calculate Shipping Rates

```bash
curl -X POST http://localhost:3000/api/v1/shipping/calculate \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "product-id-here",
        "quantity": 1,
        "price": 99.99
      }
    ],
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main Street",
      "city": "Berlin",
      "state": "Berlin",
      "postalCode": "10115",
      "country": "DE"
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "carrier": "fedex",
        "serviceName": "FedEx Ground",
        "deliveryDays": 3,
        "totalPrice": 15.99,
        "currency": "EUR"
      },
      {
        "carrier": "ups",
        "serviceName": "UPS Standard",
        "deliveryDays": 2,
        "totalPrice": 12.99,
        "currency": "EUR"
      },
      {
        "carrier": "dhl",
        "serviceName": "DHL Express",
        "deliveryDays": 1,
        "totalPrice": 10.99,
        "currency": "EUR"
      }
    ],
    "qualifiesForFreeShipping": false
  }
}
```

#### Test 2: Create Shipment Label

```bash
curl -X POST http://localhost:3000/api/v1/shipping/admin/shipments \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-id-here",
    "carrier": "fedex",
    "serviceCode": "fedex_ground",
    "packages": [
      {
        "weight": 2,
        "weightUnit": "lb",
        "length": 12,
        "width": 8,
        "height": 6,
        "dimensionUnit": "in"
      }
    ]
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "trackingNumber": "794615950361",
    "labelUrl": "https://...",
    "carrier": "fedex",
    "cost": 15.99
  }
}
```

#### Test 3: Track Shipment

```bash
curl -X GET http://localhost:3000/api/v1/shipping/track/fedex/794615950361 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "carrier": "fedex",
    "trackingNumber": "794615950361",
    "status": "In Transit",
    "statusDescription": "Package in transit",
    "estimatedDelivery": "2026-04-17",
    "events": [
      {
        "timestamp": "2026-04-14T08:30:00Z",
        "location": "Berlin, Germany",
        "description": "Package picked up",
        "status": "Picked Up"
      },
      {
        "timestamp": "2026-04-14T14:00:00Z",
        "location": "Hamburg, Germany",
        "description": "In transit",
        "status": "In Transit"
      }
    ]
  }
}
```

---

## 🆘 Troubleshooting

### Chat Widget Not Showing?

#### Problem 1: Still seeing placeholder or nothing

```bash
# Check if Drift script loads
# Open browser DevTools (F12) → Console tab → Type:
window.drift
# If you see: undefined → Script didn't load
# If you see: Object { load: ƒ, ... } → Script loaded
```

**Solution:**

1. Verify real Drift ID was added (not "APPLICATION_ID")
2. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Clear browser cache: DevTools → Application → Clear Storage
4. Check browser console for errors (red messages)

#### Problem 2: Chat loads but no messages send

```bash
# Check Drift configuration
# In Drift dashboard: https://dash.driftt.com/settings/
# Verify: Website domain is whitelisted
# Add your domain: https://yourdomain.com
```

**Solution:**

1. Go to: https://dash.driftt.com/settings/installation
2. Find: "Allowed Domains" or "CORS Settings"
3. Add your domain
4. Retry sending message

#### Problem 3: Drift shows in one app but not another

```bash
# You may have updated one file but not the other
# Verify BOTH files have real Drift ID:

grep -n "drift.load" admin-dashboard/components/DriftChat.tsx
grep -n "drift.load" e-commerce-web-store/src/components/layout/DriftChat.tsx

# Both should show your Drift ID, not "APPLICATION_ID"
```

---

### Shipping Not Working?

#### Problem 1: No shipping rates showing

```bash
# Check shipping service logs
docker compose logs api | grep -i shipping
```

**Fix:**

1. Verify carriers are configured:

   ```bash
   # Admin Dashboard → Settings → Shipping
   # Check: FedEx, UPS, DHL are enabled
   ```

2. Verify API migration ran:

   ```bash
   docker compose exec postgres psql -U postgres -d tech_tools -c \
     "SELECT * FROM information_schema.tables WHERE table_name='shipping_providers';"
   ```

   Should return 1 row (table exists)

3. Check order endpoint responses:
   ```bash
   # Get auth token first, then:
   curl -X POST http://localhost:3000/api/v1/shipping/calculate \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"items": [...], "shippingAddress": {...}}'
   ```

#### Problem 2: "Route not found" for shipping

```bash
# Verify shipping routes are registered
curl http://localhost:3000/api/v1/shipping
# Should return 401 (auth required) or shipping data
# NOT 404 (route not found)
```

**Fix:**

```bash
# Check if shipping routes imported in main router
grep "shippingRoutes" /home/mukulah/Enterprise-Grade-E-commerce/tech-tools-api/src/api/v1/index.ts

# Must show:
# import shippingRoutes from './shipping/shipping.routes'
# router.use('/shipping', shippingRoutes)
```

#### Problem 3: Carrier API errors

```bash
# Check carrier credentials
# Admin Dashboard → Settings → Shipping → Carrier Config
# Verify: FedEx API Key, UPS Client ID, DHL API Key are filled in
```

**If credentials missing:**

1. Get test credentials:

   - FedEx: https://developer.fedex.com/
   - UPS: https://developer.ups.com/
   - DHL: https://developer.dhl.com/

2. Add to `.env` file:

   ```
   FEDEX_API_KEY=your_key
   FEDEX_ACCOUNT_NUMBER=your_account
   UPS_CLIENT_ID=your_id
   UPS_CLIENT_SECRET=your_secret
   DHL_API_KEY=your_key
   ```

3. Restart API: `./server-scripts/rebuild.sh`

---

## 📊 Full Test Scenario

### Complete End-to-End Test (10 minutes):

```
1. ✅ Verify Drift ID configured (see chat widget)
2. ✅ Go to web store: https://yourdomain.com
3. ✅ Add product to cart
4. ✅ Go to checkout
5. ✅ Select "Guest Checkout"
6. ✅ Fill shipping details → See shipping rates
7. ✅ Select FedEx
8. ✅ Complete payment with test card
9. ✅ Confirmation email received
10. ✅ Go to admin dashboard → See order
11. ✅ Click "Create Shipment" → Get tracking label
12. ✅ Test chat widget → Send message
13. ✅ Receive test message in Drift dashboard
```

**All 13 steps pass?** → System is fully working! 🎉

---

## 🎯 Quick Verification Checklist

Run these commands to verify everything is in place:

```bash
# 1. Chat configured
grep -c "drift.load" admin-dashboard/components/DriftChat.tsx
# Expected: 1 (should show once)

# 2. Shipping routes registered
grep "router.use.*shipping" tech-tools-api/src/api/v1/index.ts
# Expected: Shows the route registration

# 3. Database tables exist
docker compose exec postgres psql -U postgres -d tech_tools -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('shipping_providers', 'shipments');"
# Expected: 2

# 4. API health
curl http://localhost:3000/api/v1/health
# Expected: { success: true }

# 5. No critical errors
docker compose logs --tail=20 | grep -i "error.*critical"
# Expected: No output (no critical errors)
```

---

## 📞 Still Having Issues?

1. **Share error messages:** What do you see in browser console (F12)?
2. **Check logs:** `docker compose logs api | tail -50`
3. **Verify deployment:** `./server-scripts/rebuild.sh` and wait for success
4. **Restart everything:** `docker compose restart && docker compose logs -f`

---

## ✨ Expected Working State

### Chat Widget:

- ✅ Appears in bottom-right of web store
- ✅ Can type messages
- ✅ Messages appear in Drift dashboard
- ✅ Admin can reply in real-time

### Shipping:

- ✅ Checkout shows 3 carrier options
- ✅ Each carrier shows price + delivery time
- ✅ Can select carrier before payment
- ✅ Admin can generate shipping labels
- ✅ Customers get tracking number

**Let me know if you see any errors and I'll help fix them!** 🚀
