# QUICK START: Deploy & Test (Copy-Paste Commands)

## 🚀 DEPLOY IN 5 MINUTES

### Step 1: SSH to Server

```bash
ssh root@46.225.126.93
```

### Step 2: Pull & Migrate

```bash
cd /home/mukulah/Enterprise-Grade-E-commerce && \
git pull origin main && \
npm run migrate && \
./server-scripts/rebuild.sh
```

### Step 3: Monitor Rebuild

```bash
docker compose logs -f api
```

**Wait for:**

```
api    | ✅ Server running on port 3001
api    | ✅ Guest checkout routes registered
```

Then press `Ctrl+C` to exit logs.

### Step 4: Test Guest Checkout API

```bash
curl -X POST http://localhost:3000/api/v1/orders/guest/create \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "product-id", "quantity": 1}],
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Berlin",
      "state": "Berlin",
      "postalCode": "10115",
      "country": "DE"
    },
    "guestEmail": "test.guest@example.com",
    "guestPhone": "+49123456789",
    "paymentIntentId": "pi_test123",
    "paymentMethod": "card"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "uuid-here",
    "orderNumber": "TT-XXXXXXXX-XXXX",
    "checkoutToken": "token-here",
    "email": "test.guest@example.com",
    "grandTotal": 99.99
  }
}
```

### Step 5: Configure Drift Chat

```bash
# Open in text editor
nano admin-dashboard/components/DriftChat.tsx
```

Find this line:

```typescript
window.drift.load('APPLICATION_ID')
```

Replace `APPLICATION_ID` with your real Drift ID from https://dash.driftt.com/

Same for web store:

```bash
nano e-commerce-web-store/src/components/layout/DriftChat.tsx
```

Then redeploy frontend:

```bash
./server-scripts/rebuild.sh
```

### Step 6: Verify Everything

**Web Store (Guest Checkout):**

1. Go to: https://yourdomain.com/checkout
2. Look for "Guest Checkout" toggle
3. Fill form and test checkout

**Admin Dashboard:**

1. Go to: https://admin.yourdomain.com
2. Look for Drift chat in bottom right
3. Try sending a message

**Shipping:**

1. Admin Dashboard → Orders
2. Open any order
3. Click "Create Shipment"
4. Select FedEx/UPS/DHL
5. Download label

---

## 📋 QUICK TEST SCENARIOS

### Test 1: Guest Order

```bash
# Create guest order
curl -X POST http://46.225.126.93:3000/api/v1/orders/guest/create \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "...", "quantity": 1}],
    "shippingAddress": {...},
    "guestEmail": "test@test.com",
    "paymentIntentId": "pi_xxx"
  }'

# Retrieve guest order
curl "http://46.225.126.93:3000/api/v1/orders/guest/retrieve?email=test@test.com&token=TOKEN_HERE"
```

### Test 2: Shipping Rates

```bash
curl -X POST http://46.225.126.93:3000/api/v1/shipping/calculate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "...", "quantity": 1, "price": 100}],
    "shippingAddress": {
      "city": "Berlin",
      "postalCode": "10115",
      "country": "DE"
    }
  }'
```

### Test 3: Drift Chat Loads

```bash
# Open browser console (F12)
# In Console tab, type:
window.drift
# Should return: Object { load: ƒ, ... }
```

---

## ✅ DEPLOYMENT VERIFICATION CHECKLIST

Copy this and check off:

```bash
# 1. Database Migration
docker compose exec postgres psql -U postgres -d tech_tools -c "SELECT * FROM guest_checkouts LIMIT 1;"
# Expected: Empty results (table exists)

# 2. API Routes
curl http://46.225.126.93:3000/api/v1/orders/guest/create \
  -H "Content-Type: application/json" \
  -d '{"items": []}'
# Expected: 400 error about missing items (route exists)

# 3. Disk Space
df -h / | tail -1
# Expected: >20GB available

# 4. All Containers Running
docker compose ps
# Expected: All showing "Up X minutes"

# 5. No Critical Errors
docker compose logs --tail=50 | grep -i error
# Expected: No ERROR logs (only warnings OK)
```

---

## 🆘 ROLLBACK (If Something Breaks)

```bash
# Go back to previous version
cd /home/mukulah/Enterprise-Grade-E-commerce
git reset --hard HEAD~1
npm run migrate
./server-scripts/rebuild.sh

# Monitor
docker compose logs -f api
```

---

## 📞 IF DEPLOYMENT FAILS

Check logs:

```bash
# Full log dump
docker compose logs > deployment.log 2>&1
cat deployment.log | grep -i "error\|failed\|cannot"

# Specific service logs
docker compose logs api
docker compose logs postgres
docker compose logs nginx

# Check disk space (must be >5GB)
df -h /

# Check database connection
docker compose exec postgres psql -U postgres -c "SELECT version();"
```

---

## 🎯 DONE!

After all tests pass:

1. ✅ Guest checkout working
2. ✅ Shipping rates displaying
3. ✅ Drift chat appears
4. ✅ No errors in logs
5. ✅ Database migrated

**You're ready to** 🚀 **LAUNCH!**

---

### Social Media Announcement Template

```
🎉 BIG NEWS! TechTools is now OPEN for business!

✅ Checkout as guest (no account needed)
✅ Multiple shipping options (FedEx, UPS, DHL)
✅ Live 24/7 customer support
✅ Same-day order processing
✅ 30-day easy returns

Start shopping now: https://yourdomain.com

🏆 First 100 customers get 15% OFF with code LAUNCH15
```
