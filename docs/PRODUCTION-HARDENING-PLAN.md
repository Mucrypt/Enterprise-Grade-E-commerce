# Production Hardening & Growth Readiness Plan

## TechTools Store — techtoolstore.com

> **Purpose:** Systematic improvement checklist before scaling paid advertising on TikTok, Facebook, Instagram, and YouTube.
> **Last audited:** April 30, 2026
> **Stack:** Hetzner VPS (Ubuntu 24.04) · Node/Express API · Next.js Admin · React/Vite Web Store · Expo React Native (Play Store) · PostgreSQL · Redis · Nginx · Docker Compose

---

## Status Legend

| Symbol | Meaning                            |
| ------ | ---------------------------------- |
| ✅     | Done / Already secure              |
| 🔴     | Critical — fix before ads go live  |
| 🟠     | High — fix before scaling spend    |
| 🟡     | Medium — fix for better conversion |
| 🟢     | Enhancement — nice to have         |
| ⏳     | In progress / Pending screenshots  |

---

## PHASE 1 — Critical Security (Before Any Ad Spend)

### 1.1 Enable HSTS in Nginx

**Status:** 🔴 Not done  
**Risk:** Without HSTS, browsers can be downgraded from HTTPS to HTTP on repeat visits (man-in-the-middle attack vector).  
**File:** `infrastructure/nginx/prod.conf`  
**Fix:** Uncomment this line inside the `server { listen 443 ... }` block:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**After:** Submit domain to https://hstspreload.org  
**Effort:** 5 minutes · Requires nginx reload on server (`./server-scripts/nginx-reload.sh`)

---

### 1.2 pgAdmin Public Exposure

**Status:** ✅ Hardened (private-only access model)  
**Risk:** pgAdmin at `/pgadmin` gives direct database GUI access to the public internet. If credentials are weak or leaked, entire database is exposed.  
**Implemented hardening:**

- Public nginx route `/pgadmin` now returns `404` (no reverse proxy exposure)
- pgAdmin is bound to localhost only (`127.0.0.1:5050:80`) in production compose
- Insecure fallback credentials removed; `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` are now required

**Secure access method (super admin only):**

```bash
ssh -L 5050:localhost:5050 root@46.225.126.93
# then open http://localhost:5050
```

**Verification checks on live server:**

```bash
# Must be NOT found publicly
curl -I https://techtoolstore.com/pgadmin

# Must show localhost-only binding (not 0.0.0.0)
docker ps --format '{{.Names}}\t{{.Ports}}' | grep pgadmin
```

Expected: `/pgadmin` returns `404`, and pgAdmin port mapping is `127.0.0.1:5050->80/tcp`.

---

### 1.3 Tighten Auth Rate Limits

**Status:** 🔴 Too loose  
**Risk:** Current config allows ~300 login attempts/hour per IP. Brute-force attacks on customer accounts are trivial.  
**File:** `infrastructure/nginx/nginx.prod.conf`  
**Current:**

```nginx
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
```

**Fix (in `nginx.prod.conf`):**

```nginx
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
```

**Fix (in `prod.conf` — update burst):**

```nginx
location ~ ^/api/v1/auth/(login|register) {
    limit_req zone=auth_limit burst=2 nodelay;
    ...
}
```

Change `burst=3` → `burst=2` to only allow 2 immediate bursts instead of 3.  
Add lockout logic in the API for 5 failed attempts (account-level, not just IP-level).  
**Effort:** 15 minutes

---

### 1.4 Confirm Live Server `.env` Has Real Secrets

**Status:** 🔴 Must verify  
**Risk:** The `tech-tools-api/.env` file in the repo contains placeholder values. If the live server accidentally uses this file, the entire app is running with default/known-public secrets.  
**Action on live server:**

```bash
ssh root@46.225.126.93
grep JWT_SECRET /root/Enterprise-Grade-E-commerce/tech-tools-api/.env
grep DB_PASSWORD /root/Enterprise-Grade-E-commerce/tech-tools-api/.env
grep STRIPE_SECRET_KEY /root/Enterprise-Grade-E-commerce/tech-tools-api/.env
```

Expected: All values should be long random strings, NOT `your-super-secret-jwt-key-change-in-production`.  
**If they are still placeholders — STOP everything and rotate all secrets immediately.**  
**Check infrastructure `.env` too:**

```bash
cat /root/Enterprise-Grade-E-commerce/.env
```

**Effort:** 10 minutes verification

---

## PHASE 2 — Infrastructure Stability (Before Scaling Traffic)

### 2.1 Free Up Disk Space

**Status:** 🟠 78.1% used (116GB / 149GB)  
**Risk:** Ads traffic → more orders, more uploads, more logs → disk full → site down.  
**Action on live server:**

```bash
# Check what's taking space
du -sh /var/lib/docker/*
docker system df

# Clean up unused Docker build cache, dangling images, stopped containers
docker system prune -a --volumes
# WARNING: This removes ALL unused images. Only run when all services are healthy.
# Safer alternative (keeps running images):
docker system prune -f
docker image prune -f
docker builder prune -f
```

Expected savings: 10–30GB  
**After cleanup:** Set a disk alert. If using Hetzner Cloud:

- Enable monitoring in Hetzner console → Alerts → Disk > 85%
  **Effort:** 20 minutes

---

### 2.2 Confirm Automated Database Backups

**Status:** 🟠 Script exists, cron not confirmed  
**Risk:** No automated backups = one bad migration or disk failure = all customer/order data gone.  
**Check on live server:**

```bash
crontab -l
# Should show something like:
# 0 2 * * * /root/Enterprise-Grade-E-commerce/server-scripts/backup-db.sh
```

**If no cron entry exists, add it:**

```bash
crontab -e
# Add this line (runs backup at 2am daily):
0 2 * * * /root/Enterprise-Grade-E-commerce/server-scripts/backup-db.sh >> /root/backup.log 2>&1
```

**Also verify backup script writes to a path that is mounted or synced off-server.**  
Recommended: add Hetzner Snapshot or sync backups to a remote location (S3, Backblaze B2).  
**Effort:** 30 minutes

---

### 2.3 Fix Real API Health Check Through Nginx

**Status:** 🟠 False healthy signal  
**Risk:** The `/health` location in nginx returns `200 "healthy\n"` directly from nginx — it does NOT proxy to the real API. If the API container crashes, nginx will still report healthy.  
**File:** `infrastructure/nginx/prod.conf`  
**Current:**

```nginx
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

**Fix:**

```nginx
location /health {
    access_log off;
    proxy_pass http://api_backend/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_connect_timeout 5s;
    proxy_read_timeout 5s;
}
```

**Effort:** 10 minutes · Requires nginx reload

---

### 2.4 System Restart Pending (Server Notification)

**Status:** 🟠 Server shows `*** System restart required ***`  
**Risk:** Pending kernel security patches are not applied until restart.  
**Action:** Schedule a maintenance window, then:

```bash
# On live server
reboot
# After ~60 seconds, verify all containers came back up
docker ps | grep techtools
./server-scripts/status.sh
```

All containers have `restart: always` so they will auto-start.  
**Effort:** 5 minutes downtime

---

### 2.5 Set Up Cloudflare CDN for Media Files

**Status:** 🟠 Not confirmed active  
**Risk:** All product images served from a single VPS. Social media ad campaigns create image-heavy traffic spikes that can saturate the server.  
**Steps:**

1. Point domain DNS through Cloudflare (orange cloud ☁️ on both `techtoolstore.com` and `www.techtoolstore.com`)
2. In Cloudflare → Caching → Cache Rules: cache `/media/*` for at least 7 days
3. In Cloudflare → Speed → Auto Minify: enable for JS, CSS, HTML
4. In Cloudflare → DDoS Protection: ensure enabled (free tier covers this)
5. Update `CDN_DOMAIN` in API `.env` to the Cloudflare URL if using Cloudflare Transform Rules

**After Cloudflare is active:**

- Direct IP access (`http://46.225.126.93`) should ideally be blocked (Cloudflare "Under Attack Mode" or firewall rule to only allow Cloudflare IPs)
  **Effort:** 1–2 hours (pending Cloudflare screenshot review)

---

## PHASE 3 — Conversion & Ad Readiness (Before Launching Campaigns)

### 3.1 Add Open Graph / Social Meta Tags to Web Store

**Status:** 🟡 Missing  
**Impact:** Without OG meta tags, Facebook/Instagram/TikTok ad link previews show blank images and no product title. This directly kills click-through rate on link-based ads.  
**Files to update:**

- `e-commerce-web-store/index.html` — default OG tags for the store
- `e-commerce-web-store/src/pages/ProductDetailPage.tsx` — dynamic OG per product
- `e-commerce-web-store/src/pages/HomePage.tsx` — store-level OG

**Implementation:**  
Install: `npm install react-helmet-async` in `e-commerce-web-store`  
Add to each page:

```tsx
import { Helmet } from 'react-helmet-async'

// Inside ProductDetailPage, after product data loads:
;<Helmet>
  <title>{product.name} — TechTools Store</title>
  <meta property='og:title' content={product.name} />
  <meta
    property='og:description'
    content={product.description?.slice(0, 160)}
  />
  <meta
    property='og:image'
    content={`https://techtoolstore.com/media/products/images/${product.image_url}`}
  />
  <meta
    property='og:url'
    content={`https://techtoolstore.com/products/${product.slug}`}
  />
  <meta property='og:type' content='product' />
  <meta
    property='og:price:amount'
    content={product.sale_price || product.base_price}
  />
  <meta property='og:price:currency' content='USD' />
  <meta name='twitter:card' content='summary_large_image' />
</Helmet>
```

**Effort:** 2–3 hours

---

### 3.2 Add sitemap.xml and robots.txt

**Status:** 🟡 Not confirmed present  
**Impact:** Google Shopping ads and SEO organic traffic both require sitemap. Without it, product pages may not be indexed.  
**Action:**

1. Check if it exists: `curl https://techtoolstore.com/sitemap.xml`
2. If not — generate a sitemap from the API (all product slugs, category slugs, blog slugs)
3. Add a `GET /sitemap.xml` route to the API that queries the DB and returns XML
4. Add `public/robots.txt` to the web store with:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://techtoolstore.com/sitemap.xml
```

**Effort:** 3–4 hours (API route + web store static file)

---

### 3.3 Fix Flash Deals — Use Real Time-Limited Products

**Status:** 🟡 Misleading UX  
**Impact:** Flash deals are currently just `featuredProducts.slice(0, 8)` — not real time-limited deals. Customers see a countdown timer to nothing. This destroys trust and hurts conversion.  
**Files:**

- `tech-tools-mobile-app/src/app/(tabs)/index.tsx`
- `e-commerce-web-store/src/components/home/FlashDealsSection.tsx`

**Fix options:**

1. Add a `flash_deal_ends_at` column to the products table (migration needed)
2. Or use the existing `collections` feature — create a "Flash Deals" collection with an expiry field
3. Update the home screen to fetch from `/api/v1/products?flash_deal=true` only
4. Countdown timer should use the actual `flash_deal_ends_at` value from the API

**Effort:** 4–6 hours (DB migration + API + both frontends)

---

### 3.4 Fix Mobile App `versionCode` Inconsistency

**Status:** 🟠 Blocking future Play Store releases  
**File:** `tech-tools-mobile-app/app.json`  
**Current:** `"versionCode": 1` but the latest AAB is `techtools-v13.aab`  
**Fix:**

```json
{
  "expo": {
    "version": "1.13.0",
    "android": {
      "versionCode": 13
    }
  }
}
```

**Rule going forward:** Every Play Store release must increment `versionCode` by 1. Keep `version` as semantic version (e.g., `1.14.0`).  
**Effort:** 5 minutes · Requires new build + Play Store submission for next release

---

### 3.5 Web Store Token Storage — Move to httpOnly Cookies

**Status:** 🟡 Medium risk (XSS surface)  
**Risk:** `localStorage` tokens are readable by any JavaScript on the page, including third-party ad pixels (Facebook Pixel, TikTok Pixel, Google Tag Manager). A single XSS in a pixel script can steal all customer sessions.  
**Files:**

- `e-commerce-web-store/src/api/index.ts` — uses `localStorage.getItem('auth_token')`
- `admin-dashboard/lib/api-client.ts` — uses `localStorage.getItem('accessToken')`

**Fix approach:**

1. API: set `accessToken` as `httpOnly; Secure; SameSite=Strict` cookie on login
2. Web store: remove manual token from axios header; let browser send cookie automatically
3. API CORS: ensure `credentials: true` on the specific origin (already set)
4. Admin dashboard: same pattern — cookie-based auth, not localStorage

**Note:** This is a larger refactor. Do AFTER the quick wins above but BEFORE heavy ad spend.  
**Effort:** 6–8 hours across API + web store + admin

---

### 3.6 Add Facebook Pixel, TikTok Pixel, Google Analytics 4

**Status:** 🟡 Not present (required for ad attribution)  
**Impact:** Without pixels, Facebook/TikTok/Google cannot optimize ad delivery for purchases. You'll be spending money with no attribution data.  
**Required pixels:**

- **Facebook/Instagram:** Meta Pixel + Conversions API (server-side for iOS 14+ accuracy)
- **TikTok:** TikTok Pixel
- **Google:** GA4 + Google Ads conversion tracking + Google Shopping feed
- **YouTube:** Google Ads remarketing pixel

**Implementation plan:**

1. Use Google Tag Manager (GTM) as the single container — add one GTM script to the web store
2. Inside GTM: configure all pixels, fire `Purchase` event on order confirmation page
3. Pass `value`, `currency`, `transaction_id` with every Purchase event
4. For Meta Conversions API: add server-side event from the order controller (most accurate)
5. Mobile app: add `expo-tracking-transparency` + `@segment/analytics-react-native` or individual SDKs

**Effort:** 8–12 hours (web store + API server-side events)

---

## PHASE 4 — Performance & Scale

### 4.1 Product Image Optimization Pipeline

**Status:** 🟢 Enhancement  
**Impact:** Faster page load = higher ad conversion rate. Every 100ms of delay reduces conversions ~1%.  
**Current:** Images stored as uploaded (likely unoptimized JPEGs/PNGs)  
**Fix:**

1. On upload, auto-generate WebP versions at multiple sizes (thumbnails already exist)
2. Add `srcset` to product images in web store and mobile
3. Use Cloudflare Image Resizing (available on paid plans) or `sharp` on the server

---

### 4.2 API Response Caching for Product Listings

**Status:** 🟢 Enhancement  
**Impact:** Product listing pages hit DB on every request. With ad traffic spikes, this can overwhelm the DB.  
**Fix:** Add Redis cache with 5-minute TTL to:

- `GET /api/v1/products` (listing)
- `GET /api/v1/categories`
- `GET /api/v1/brands`
- `GET /api/v1/products/featured`

Already have Redis running — just needs cache middleware added to these routes.  
**Effort:** 3–4 hours

---

### 4.3 Add Connection Pooling Config for PostgreSQL

**Status:** 🟢 Enhancement  
**Check:** `tech-tools-api/src/database/connection.ts` — confirm `max` pool size is set appropriately.  
Recommended: `max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000`  
**Effort:** 30 minutes

---

## PHASE 5 — Mobile App Updates

### 5.1 Push Notification Deep Links for Ad Campaigns

**Status:** 🟢 Enhancement  
**Impact:** After someone installs from a TikTok/Instagram ad, you can retarget them with push notifications linking directly to sale items.  
**Current:** `useNotifications.ts` and `notification.service.ts` exist — need deep link routing.  
**Fix:** Add Expo deep link handlers to route push notification taps to:

- `/product/[slug]` — specific product
- `/categories` — sale category
- `/(tabs)/trending` — trending page

---

### 5.2 App Store (iOS) Submission

**Status:** 🟡 Currently Android only  
**Impact:** iOS users (~40-50% of mobile ad traffic) cannot install the app.  
**Requirements:**

- Apple Developer account ($99/year)
- Build with EAS: `eas build --platform ios`
- App Store Connect submission
- `enableApplePay: false` in `app.json` — can enable for iOS later

---

## Quick Reference — Deployment Commands

```bash
# SSH to server
ssh root@46.225.126.93

# Check status
cd ~/Enterprise-Grade-E-commerce && ./server-scripts/status.sh

# Reload nginx (after config changes)
./server-scripts/nginx-reload.sh

# Restart a specific service
./server-scripts/restart.sh api
./server-scripts/restart.sh admin
./server-scripts/restart.sh web
./server-scripts/restart.sh nginx

# Full update + redeploy
./server-scripts/update.sh all

# View logs
./server-scripts/logs.sh api
./server-scripts/logs.sh nginx

# Private pgAdmin access (SSH tunnel)
ssh -L 5050:localhost:5050 root@46.225.126.93
# then open http://localhost:5050

# Manual database backup
./server-scripts/backup-db.sh

# Free up disk
docker system prune -f && docker image prune -f && docker builder prune -f
```

---

## Completion Tracker

| #   | Task                                            | Priority       | Status     | Est. Effort |
| --- | ----------------------------------------------- | -------------- | ---------- | ----------- |
| 1.1 | Enable HSTS in nginx                            | 🔴 Critical    | ⬜ Todo    | 5 min       |
| 1.2 | pgAdmin private access (localhost + SSH tunnel) | 🔴 Critical    | ✅ Done    | 30 min      |
| 1.3 | Tighten auth rate limits                        | 🔴 Critical    | ⬜ Todo    | 15 min      |
| 1.4 | Verify live server `.env` secrets               | 🔴 Critical    | ⬜ Todo    | 10 min      |
| 2.1 | Free up disk space                              | 🟠 High        | ⬜ Todo    | 20 min      |
| 2.2 | Confirm/add backup cron                         | 🟠 High        | ⬜ Todo    | 30 min      |
| 2.3 | Fix real API health check in nginx              | 🟠 High        | ⬜ Todo    | 10 min      |
| 2.4 | Apply pending server restart                    | 🟠 High        | ⬜ Todo    | 5 min       |
| 2.5 | Confirm Cloudflare CDN active for media         | 🟠 High        | ⏳ Pending | 1–2 hr      |
| 3.1 | Add OG meta tags to web store                   | 🟡 Medium      | ⬜ Todo    | 2–3 hr      |
| 3.2 | Add sitemap.xml + robots.txt                    | 🟡 Medium      | ⬜ Todo    | 3–4 hr      |
| 3.3 | Fix flash deals to use real DB data             | 🟡 Medium      | ⬜ Todo    | 4–6 hr      |
| 3.4 | Fix mobile versionCode in app.json              | 🟠 High        | ⬜ Todo    | 5 min       |
| 3.5 | Move web store tokens to httpOnly cookies       | 🟡 Medium      | ⬜ Todo    | 6–8 hr      |
| 3.6 | Add ad pixels (Meta, TikTok, GA4)               | 🟡 Medium      | ⬜ Todo    | 8–12 hr     |
| 4.1 | Product image WebP optimization                 | 🟢 Enhancement | ⬜ Todo    | 4 hr        |
| 4.2 | Redis cache for product listing APIs            | 🟢 Enhancement | ⬜ Todo    | 3–4 hr      |
| 4.3 | PostgreSQL connection pool tuning               | 🟢 Enhancement | ⬜ Todo    | 30 min      |
| 5.1 | Push notification deep links (mobile)           | 🟢 Enhancement | ⬜ Todo    | 3–4 hr      |
| 5.2 | iOS App Store submission                        | 🟡 Medium      | ⬜ Todo    | varies      |

---

## Already Solid — Do Not Change

- ✅ Nginx gzip, keepalive, worker tuning
- ✅ `helmet()` CSP + security headers on API
- ✅ JWT access + refresh token rotation via Redis
- ✅ Docker healthchecks with `condition: service_healthy`
- ✅ `restart: always` on all containers
- ✅ Log rotation on all containers
- ✅ Mobile uses `expo-secure-store` (not AsyncStorage) for tokens
- ✅ 20 sequential DB migrations — clean schema management
- ✅ WhatsApp + email notifications on new orders
- ✅ Stripe integration with pinned API version
- ✅ `trust proxy 1` set correctly for rate limiting behind nginx
- ✅ Redis password protected
- ✅ Stripe webhook secret validation
- ✅ `server_tokens off` in nginx (hides server version)

---

_Share the Cloudflare screenshots when ready and we'll update items 1.2 and 2.5 accordingly._
