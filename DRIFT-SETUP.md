# Drift Live Chat Setup Guide

## Overview

Drift is now integrated into both the e-commerce web store and admin dashboard for real-time customer support and live chat.

## Prerequisites

1. **Drift Account**: Sign up at [https://drift.com](https://drift.com)
2. **Drift Workspace**: Create a workspace for your TechTools store

## Getting Your Drift App ID

### Step 1: Log into Drift Dashboard

1. Go to [https://dash.driftt.com/](https://dash.driftt.com/)
2. Log in with your Drift credentials

### Step 2: Find Your App ID

1. Navigate to **Settings** → **Installation**
2. Copy your **Drift App ID** (looks like: `a1b2c3d4e5f6g7h8`)
3. Keep this ID safe - you'll need it for configuration

### Step 3: Verify Installation Code

Your installation code should look like:

```html
<!-- Drift Chat -->
<script>
  'use strict'
  !(function () {
    let e = (window.driftt = window.drift = window.drift || []),
      t = !1
    // ... your code ...
    window.drift.load('YOUR_DRIFT_APP_ID')
  })()
</script>
```

Copy the **App ID** from your code (the parameter in `window.drift.load()`)

## Configuration

### For Web Store (e-commerce)

1. Create or edit `/e-commerce-web-store/.env.local`

```bash
# Add this line with your Drift App ID
VITE_DRIFT_APP_ID=a1b2c3d4e5f6g7h8
```

2. For production, update:
   - `.env.production` - Production environment
   - `.env.staging` - Staging environment

### For Admin Dashboard

1. Create or edit `/admin-dashboard/.env.local`

```bash
# Add this line with your Drift App ID
NEXT_PUBLIC_DRIFT_APP_ID=a1b2c3d4e5f6g7h8
```

2. For production, update:
   - `.env.production.local` - Production environment

## Deployment

### Environment Variables in Production

When deploying to production servers:

**Web Store (Vite)**:

```bash
# Add to your deployment environment
export VITE_DRIFT_APP_ID=your_actual_app_id
```

**Admin Dashboard (Next.js)**:

```bash
# Add to your deployment environment
export NEXT_PUBLIC_DRIFT_APP_ID=your_actual_app_id
```

### Docker Environment

If using Docker, add to your docker-compose.yml:

```yaml
environment:
  - VITE_DRIFT_APP_ID=your_actual_app_id
  - NEXT_PUBLIC_DRIFT_APP_ID=your_actual_app_id
```

## Implementation Details

### Web Store

**File**: `e-commerce-web-store/src/components/layout/DriftChat.tsx`

- Loads Drift script dynamically
- Initializes with your App ID from `VITE_DRIFT_APP_ID`
- Automatically handles users' conversations
- Gracefully handles missing configuration

### Admin Dashboard

**File**: `admin-dashboard/components/DriftChat.tsx`

- Similar implementation for admin support
- Uses `NEXT_PUBLIC_DRIFT_APP_ID` environment variable
- Enables admins to chat with customers in real-time

## Features

### Current Implementation

✅ **Live Chat Widget** - Customer-facing chat interface on web store
✅ **Admin Support** - Chat support in admin dashboard  
✅ **Dynamic Loading** - Drift script loads only when configured
✅ **Error Handling** - Gracefully handles missing or invalid App IDs
✅ **Environment-Based** - Different App IDs for different environments

### Optional Features (Not Yet Implemented)

- User identification when signed in
- Custom attributes (order history, preferences)
- Real-time notifications for new messages

## Testing

### Local Testing

1. **Get a Test App ID**:

   - Go to [https://dash.driftt.com/](https://dash.driftt.com/)
   - Create a test workspace for development

2. **Set Test Environment Variables**:

   **Web Store**:

   ```bash
   echo 'VITE_DRIFT_APP_ID=your_test_app_id' > e-commerce-web-store/.env.local
   ```

   **Admin Dashboard**:

   ```bash
   echo 'NEXT_PUBLIC_DRIFT_APP_ID=your_test_app_id' > admin-dashboard/.env.local
   ```

3. **Restart Your Servers**:

   ```bash
   # Web Store
   cd e-commerce-web-store && npm run dev

   # Admin Dashboard (in new terminal)
   cd admin-dashboard && npm run dev
   ```

4. **Verify in Browser**:

   - Open http://localhost:5173 (web store)
   - You should see a Drift chat widget in the bottom right
   - Open http://localhost:3001 (admin dashboard)
   - You should see the chat widget there too

5. **Check Browser Console**:
   - If you see error messages about missing App ID, configuration is wrong
   - If widget appears, configuration is correct

## Troubleshooting

### Widget Not Showing

**Issue**: "Failed to load Drift chat widget"

**Causes**:

1. ❌ `VITE_DRIFT_APP_ID` or `NEXT_PUBLIC_DRIFT_APP_ID` not set
2. ❌ Invalid App ID value
3. ❌ Environment variable not reloaded after change

**Solution**:

```bash
# 1. Check your .env.local file has the correct ID
cat e-commerce-web-store/.env.local

# 2. Verify the ID format (should be alphanumeric, not "YOUR_DRIFT_APP_ID" or similar)
# Example correct format: a1b2c3d4e5f6g7h8

# 3. Restart your dev server:
# Kill the server (Ctrl+C)
# Re-run: npm run dev

# 4. Check browser console for warnings
# Open DevTools → Console tab
# Look for: "Drift chat not configured" warning
```

### App ID Format Issues

**Correct Format**:

- ✅ `a1b2c3d4e5f6g7h8` (alphanumeric)
- ✅ `123456` (numeric)

**Incorrect Format**:

- ❌ `APPLICATION_ID` (placeholder)
- ❌ `YOUR_DRIFT_APP_ID` (placeholder)
- ❌ `https://...` (full URL)

## Support

For Drift-specific issues:

1. **Drift Documentation**: [https://help.drift.com/](https://help.drift.com/)
2. **Drift Support**: [https://support.drift.com/](https://support.drift.com/)
3. **Check Dashboard Settings**: Settings → Chatbot or Chat Settings

For application issues:

1. Check browser console for error messages
2. Verify environment variables are set correctly
3. Ensure Drift dashboard shows your workspace as active

## Next Steps

1. ✋ Get your Drift App ID from dashboard
2. 📝 Update `.env.local` files with your App ID
3. 🔄 Restart your development servers
4. 🧪 Test in browser and verify widget loads
5. 📡 Deploy to production with your App ID

---

**Last Updated**: April 2026
