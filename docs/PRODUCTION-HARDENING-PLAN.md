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

### 1.1 Enable HSTS + Security Headers

**Status:** ✅ Done  
**Risk:** Without HSTS, browsers can be downgraded from HTTPS to HTTP on repeat visits (man-in-the-middle attack vector).  
**Implemented:**

- HSTS header enabled: `max-age=31536000; includeSubDomains; preload`
- Additional security headers:
  - `X-Frame-Options: SAMEORIGIN` (prevent clickjacking)
  - `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
  - `X-XSS-Protection: 1; mode=block` (XSS protection)
  - `Referrer-Policy: strict-origin-when-cross-origin` (privacy)
  - `Permissions-Policy: geolocation/microphone/camera/payment disabled`
  - `Content-Security-Policy: restrictive default sources`

**Deployed:** `/infrastructure/nginx/prod.conf` (lines 32-46)  
**Next action:** Submit domain to https://hstspreload.org for permanent browser preload list.  
**Effort:** ✅ 5 minutes (nginx reload already applied)

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

### 1.3 Tighten Auth Rate Limits + Account Lockout

**Status:** ✅ Done  
**Risk:** Brute-force attacks on customer accounts.  
**Implemented:**

**Nginx Level:**

- Rate limit: 5 requests/minute per IP
- Burst: Reduced from 3 → 2 (very tight)
- Config: `/infrastructure/nginx/prod.conf` (line 111)

**API Level (Account-Level Lockout):**

- After 5 failed login attempts, account is locked for 30 minutes
- Lock tracked in database: `users.locked_until` timestamp
- On unlock: `failed_login_attempts` reset to 0
- On successful login: Counter and lock automatically reset

**Database:** Schema migration 002_admin_management_schema.sql added columns:

- `failed_login_attempts INTEGER DEFAULT 0`
- `locked_until TIMESTAMP WITH TIME ZONE`

**Code:** `/tech-tools-api/src/api/v1/auth/auth.controller.ts`

- Login handler now checks account lockout
- Returns `429 Too Many Requests` if locked
- Increments counter on failed attempt
- Locks account after 5 fails

**Admin Management Endpoints:**

- `POST /api/v1/admin/unlock-account` — Unlock a specific user account
- `GET /api/v1/admin/locked-accounts` — View all currently locked accounts
- Config: `/tech-tools-api/src/api/v1/admin/lockout.routes.ts`

**Verification:** Login 6 times with wrong password, expect `429` on 6th attempt.  
**Effort:** ✅ 20 minutes (code deployed)

---

### 1.4 Firewall Lockdown — Block Direct Server IP Access

**Status:** ✅ Done (ready for deployment)  
**Risk:** Server IP (100.92.116.9) is directly accessible on ports 80/443, bypassing Cloudflare protection. Any threat actor can scan and find vulnerabilities without triggering Cloudflare WAF/rate limiting.  
**Implemented:**

**Firewall Setup Script:** `/infra/scripts/setup-firewall.sh`

- Uses UFW (Uncomplicated Firewall) to define strict rules
- Allows SSH (port 22) from anywhere
- Allows HTTP/HTTPS (80/443) from Cloudflare IPs only
- Blocks all other incoming traffic (default deny policy)
- Auto-updates Cloudflare IP list daily via cron job

**Daily IP Update Script:** `/infra/scripts/update-cloudflare-ips.sh`

- Runs via cron at 2 AM UTC
- Fetches latest Cloudflare IP ranges from: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
- Logs updates to `/var/log/cloudflare-ips-update.log`

**Deployment (on live server):**

```bash
ssh root@100.92.116.9
chmod +x /root/Enterprise-Grade-E-commerce/infra/scripts/setup-firewall.sh
sudo /root/Enterprise-Grade-E-commerce/infra/scripts/setup-firewall.sh

# This will:
# 1. Install UFW if needed
# 2. Reset UFW (clears existing rules)
# 3. Set default deny incoming, allow outgoing
# 4. Allow SSH on 22
# 5. Fetch Cloudflare IPs and allow 80/443 from those ranges
# 6. Enable UFW
# 7. Setup daily cron job for IP updates

# Verify rules:
sudo ufw status numbered

# Test from your machine:
curl -H "Host: techtoolstore.com" http://100.92.116.9
# Expected: connection refused or timeout (NOT 200 OK)

curl https://techtoolstore.com
# Expected: 200 OK (via Cloudflare)
```

**Verification:**

```bash
# On live server, check UFW status
sudo ufw status

# Should show:
# To Action From
# -- ------ ----
# 22 ALLOW Anywhere
# 80 ALLOW Cloudflare IP range 1
# 443 ALLOW Cloudflare IP range 1
# ... (multiple Cloudflare IP ranges)
# Anywhere DENY Anywhere (v6)
```

**Why this matters:**

- Direct IP access bypasses Cloudflare WAF, rate limiting, and DDoS protection
- Firewall lockdown ensures ALL traffic goes through Cloudflare
- If Cloudflare is down, site is down (safe failure vs. exposing raw origin)
- Prevents reconnaissance scans on the raw server

**Effort:** ✅ 5 minutes (script handles everything)  
**Rollback:** `sudo ufw disable` if issues arise

---

### 1.5 Confirm Live Server `.env` Has Real Secrets

**Status:** 🔴 Must verify  
**Risk:** The `tech-tools-api/.env` file in the repo contains placeholder values. If the live server accidentally uses this file, the entire app is running with default/known-public secrets.  
**Action on live server:**

```bash
ssh root@100.92.116.9
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
