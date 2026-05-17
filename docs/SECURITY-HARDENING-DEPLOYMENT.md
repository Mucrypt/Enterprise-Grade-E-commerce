# Production Security Hardening — Deployment Guide

**Status:** All three security layers ready for deployment  
**Timeline:** ~15 minutes total  
**Risk Level:** Low (no breaking changes, all changes are additive security)

---

## Overview

This guide walks you through deploying three critical production hardening measures:

1. ✅ **HSTS + Secure Headers** — Prevents protocol downgrade attacks
2. ✅ **Account-Level Login Lockout** — Protects accounts from brute-force
3. ✅ **Firewall Lockdown** — Blocks direct server IP access, allows only Cloudflare

---

## Prerequisites

- SSH access to server: `ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9`
- All API containers healthy: `./server-scripts/status.sh`
- Nginx healthcheck passing: `curl https://techtoolstore.com/health`

---

## Step 1: Deploy HSTS + Secure Headers (~2 minutes)

### What's being deployed:

- Uncommented and enabled HSTS header
- Added security headers: X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy
- Changed auth endpoint burst from 3 → 2 (tighter rate limit)

### On your local machine:

```bash
cd ~/Enterprise-Grade-E-commerce

# Verify nginx config syntax (local check)
docker exec techtools-nginx-prod nginx -t
# Expected: "Configuration is valid"

# View the changes (optional):
grep -A 15 "HSTS" infrastructure/nginx/prod.conf
```

### Deploy to server:

```bash
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9 << 'EOF'

# Go to project directory
cd /root/Enterprise-Grade-E-commerce

# Test nginx config
docker exec techtools-nginx-prod nginx -t
# Should output: Configuration is valid

# Reload nginx (zero downtime)
docker exec techtools-nginx-prod nginx -s reload
# Should output: signal process started

# Verify HSTS header is now present
curl -i https://techtoolstore.com | grep -i "Strict-Transport-Security"
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# View all security headers
curl -i https://techtoolstore.com | grep -E "(X-Frame-Options|X-Content-Type|Referrer-Policy|Permissions-Policy|Strict-Transport|Content-Security)"

echo "✅ HSTS + Security Headers deployed successfully"

EOF
```

### Verification:

```bash
# From your machine, confirm HSTS header
curl -i https://techtoolstore.com | grep "Strict-Transport-Security"
# Must show: max-age=31536000

# Check all security headers
curl -i https://techtoolstore.com | head -20
```

### Next: Submit to HSTS Preload List

Visit https://hstspreload.org and submit `techtoolstore.com` to be included in the browser preload list. This is optional but recommended for maximum security.

---

## Step 2: Deploy Account-Level Login Lockout (~3 minutes)

### What's being deployed:

- Updated auth.controller.ts with 5-failed-attempts lockout logic
- Lock duration: 30 minutes per account
- Admin endpoints to view/unlock locked accounts
- New admin routes file for lockout management

### On your local machine:

```bash
cd ~/Enterprise-Grade-E-commerce/tech-tools-api

# Verify the changes (optional)
grep -A 10 "locked_until" src/api/v1/auth/auth.controller.ts
grep -A 5 "MAX_ATTEMPTS = 5" src/api/v1/auth/auth.controller.ts
```

### Deploy to server:

```bash
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9 << 'EOF'

# Go to project directory
cd /root/Enterprise-Grade-E-commerce

# Pull latest code changes
git pull origin main
# (Skip if using different deployment method)

# Rebuild API with new code
docker-compose -f infrastructure/docker-compose.prod.yml build api

# Restart API container
docker-compose -f infrastructure/docker-compose.prod.yml down api
docker-compose -f infrastructure/docker-compose.prod.yml up -d api

# Wait for API to be healthy
sleep 5
curl -X GET http://localhost:9000/api/v1/health

echo "✅ Account lockout deployed successfully"

EOF
```

### Verification:

Test the lockout by attempting 6 failed logins:

```bash
# From your machine, test login endpoint
EMAIL="test@example.com"
PASSWORD_WRONG="wrongpassword"

for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST https://techtoolstore.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD_WRONG\"}"
  echo ""
  sleep 1
done

# Attempts 1-5 should return: "Invalid credentials" (401)
# Attempt 6 should return: "Too many failed login attempts. Account locked for 30 minutes." (429)
```

### Admin Endpoints:

```bash
# Get all currently locked accounts (requires admin auth token):
curl -X GET https://techtoolstore.com/api/v1/admin/locked-accounts \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Unlock a specific user:
curl -X POST https://techtoolstore.com/api/v1/admin/unlock-account \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\"}"
```

---

## Step 3: Deploy Firewall Lockdown (~5 minutes)

### What's being deployed:

- UFW firewall with strict inbound rules
- SSH always allowed
- HTTP/HTTPS only from Cloudflare IPs
- All other traffic blocked
- Daily cron job to auto-update Cloudflare IP list

### Deploy to server:

```bash
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9 << 'EOF'

# Go to project directory
cd /root/Enterprise-Grade-E-commerce

# Make firewall scripts executable
chmod +x infra/scripts/setup-firewall.sh
chmod +x infra/scripts/update-cloudflare-ips.sh

# Run firewall setup (will prompt for confirmation)
echo "yes" | sudo /root/Enterprise-Grade-E-commerce/infra/scripts/setup-firewall.sh

# Verify firewall is active and rules are correct
sudo ufw status numbered

# Check that SSH is allowed and Cloudflare IPs are whitelisted
echo "Firewall deployment complete!"

EOF
```

### Verification:

**On the server, verify firewall rules:**

```bash
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9 << 'EOF'

# Show firewall status
echo "Current UFW status:"
sudo ufw status numbered

# Should show:
# To Action From
# -- ------ ----
# 22 ALLOW Anywhere
# 80 ALLOW 173.245.48.0/20
# 443 ALLOW 173.245.48.0/20
# ... (multiple Cloudflare ranges)
# Anywhere DENY Anywhere

# Check that site is still working through Cloudflare
curl -I https://techtoolstore.com
# Expected: HTTP 200 or redirect

EOF
```

**From your machine, verify direct IP access is blocked:**

```bash
# This should timeout or refuse connection (not reach Cloudflare):
timeout 5 curl -H "Host: techtoolstore.com" http://100.92.116.9
# Expected: Connection timed out or Connection refused

# But HTTPS through domain should work:
curl -I https://techtoolstore.com
# Expected: HTTP 200 (or redirect if auth required)
```

---

## Post-Deployment Checklist

- [ ] HSTS header is present: `curl -i https://techtoolstore.com | grep Strict-Transport`
- [ ] All security headers are present: `curl -i https://techtoolstore.com | grep -E "X-Frame|X-Content|Referrer|CSP"`
- [ ] Auth burst is 2: `grep "burst=" /root/Enterprise-Grade-E-commerce/infrastructure/nginx/prod.conf`
- [ ] Login endpoint returns 429 after 5 failed attempts
- [ ] Direct IP access is blocked: `timeout 5 curl http://100.92.116.9` (times out)
- [ ] HTTPS through domain works: `curl -I https://techtoolstore.com` (200 OK)
- [ ] UFW is active: `sudo ufw status` (shows "Status: active")
- [ ] Cron job is set: `crontab -l | grep update-cloudflare`

---

## Rollback Procedures

### If HSTS causes issues:

```bash
ssh root@100.92.116.9
# Comment out HSTS header in:
vi /root/Enterprise-Grade-E-commerce/infrastructure/nginx/prod.conf

# Search for "Strict-Transport" and delete or comment the line
# Reload nginx:
docker exec techtools-nginx-prod nginx -s reload
```

### If firewall blocks traffic:

```bash
ssh root@100.92.116.9
# Disable firewall:
sudo ufw disable

# Re-enable after fixing:
sudo ufw enable
```

### If API lockout causes issues:

```bash
ssh root@100.92.116.9
# Restart API container (resets lockout logic):
docker-compose -f /root/Enterprise-Grade-E-commerce/infrastructure/docker-compose.prod.yml restart api

# To unlock all accounts via database:
docker exec techtools-postgres psql -U techtools_user -d techtools -c \
  "UPDATE users SET failed_login_attempts = 0, locked_until = NULL;"
```

---

## Monitoring

After deployment, monitor these logs:

```bash
# On server:
ssh root@100.92.116.9

# API logs (check for lockout events):
docker logs techtools-api | grep -E "(locked|failed_login_attempts|429)"

# Firewall logs:
sudo tail -f /var/log/ufw.log

# Cloudflare IP update logs:
tail -f /var/log/cloudflare-ips-update.log

# Nginx access logs (rate limit events):
docker logs techtools-nginx-prod | grep "limiting requests"
```

---

## Success Indicators

✅ **All three layers deployed successfully when:**

1. HSTS header present and max-age=31536000
2. Security headers comprehensive (X-Frame, CSP, etc.)
3. Auth endpoints reject 6th login attempt with 429
4. Direct IP access fails (connection refused/timeout)
5. HTTPS domain access works normally
6. No broken functionality in production
7. All services healthy: `./server-scripts/status.sh`

---

## Timeline

| Step      | Task                    | Time            | Status              |
| --------- | ----------------------- | --------------- | ------------------- |
| 1         | HSTS + Security Headers | 2 min           | ✅ Ready            |
| 2         | Account Lockout         | 3 min           | ✅ Ready            |
| 3         | Firewall Lockdown       | 5 min           | ✅ Ready            |
| **Total** |                         | **~10 minutes** | **Ready to deploy** |

---

## Support

If issues arise during deployment:

1. Check logs: `./server-scripts/logs.sh api`
2. Verify services: `./server-scripts/status.sh`
3. Test endpoints: `curl -v https://techtoolstore.com/api/v1/health`
4. Use rollback procedures above

---

**Deployed by:** TechTools Security Team  
**Date:** [DEPLOYMENT_DATE]  
**Version:** 1.0  
**Next Security Review:** [30 days from deployment]
