#!/bin/bash
# ===========================================
# TechTools Firewall Lockdown — Cloudflare Only
# ===========================================
# Purpose: Block direct server IP access, allow only Cloudflare IPs
# Run on server: sudo ./infra/scripts/setup-firewall.sh
# ===========================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_info "Starting firewall lockdown..."
echo ""

# Step 1: Install UFW if not present
if ! command -v ufw &> /dev/null; then
    log_info "Installing UFW..."
    apt-get update -qq
    apt-get install -y ufw >/dev/null
    log_success "UFW installed"
fi

# Step 2: Reset UFW (start fresh) — asks for confirmation
log_warn "WARNING: This will reset all existing UFW rules"
read -p "Continue? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    log_info "Aborted."
    exit 0
fi

ufw --force reset >/dev/null
log_success "UFW reset"

# Step 3: Set default deny policy
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
log_success "Default policy set: DENY incoming, ALLOW outgoing"

# Step 4: Allow SSH (CRITICAL — don't lock yourself out!)
log_info "Allowing SSH (port 22)..."
ufw allow 22/tcp >/dev/null
log_success "SSH allowed on port 22"

# Step 5: Add Cloudflare IP ranges for HTTP/HTTPS
log_info "Fetching Cloudflare IP ranges..."

# Cloudflare publishes their IPs at these URLs
CF_IPv4_URL="https://www.cloudflare.com/ips-v4"
CF_IPv6_URL="https://www.cloudflare.com/ips-v6"

# Download IPv4 ranges
CF_IPv4=$(curl -s "$CF_IPv4_URL" 2>/dev/null)
if [ -z "$CF_IPv4" ]; then
    log_error "Failed to fetch Cloudflare IPv4 ranges"
    log_warn "Using fallback hardcoded ranges (update manually if outdated)"
    # Fallback ranges (as of May 2024 — check https://www.cloudflare.com/ips/ for latest)
    CF_IPv4="173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14"
fi

# Download IPv6 ranges
CF_IPv6=$(curl -s "$CF_IPv6_URL" 2>/dev/null)
if [ -z "$CF_IPv6" ]; then
    log_warn "Failed to fetch Cloudflare IPv6 ranges (optional)"
fi

# Add IPv4 rules for HTTP and HTTPS
log_info "Adding UFW rules for Cloudflare IPs (HTTP/HTTPS)..."
while IFS= read -r ip; do
    [ -z "$ip" ] && continue
    ufw allow from "$ip" to any port 80 proto tcp >/dev/null 2>&1 || true
    ufw allow from "$ip" to any port 443 proto tcp >/dev/null 2>&1 || true
done <<< "$CF_IPv4"
log_success "IPv4 Cloudflare ranges added"

# Add IPv6 rules (if available)
if [ ! -z "$CF_IPv6" ]; then
    log_info "Adding UFW rules for Cloudflare IPv6..."
    while IFS= read -r ip; do
        [ -z "$ip" ] && continue
        ufw allow from "$ip" to any port 80 proto tcp >/dev/null 2>&1 || true
        ufw allow from "$ip" to any port 443 proto tcp >/dev/null 2>&1 || true
    done <<< "$CF_IPv6"
    log_success "IPv6 Cloudflare ranges added"
fi

# Step 6: Enable UFW
log_info "Enabling UFW..."
echo "y" | ufw enable >/dev/null
log_success "UFW enabled"

echo ""
log_success "Firewall lockdown complete!"
echo ""

# Step 7: Show summary
echo -e "${BLUE}========================================${NC}"
echo "Current UFW Rules:"
echo -e "${BLUE}========================================${NC}"
ufw status numbered

echo ""
log_info "Rules summary:"
echo "  ✓ SSH (22) — ALLOW from anywhere"
echo "  ✓ HTTP (80) — ALLOW from Cloudflare IPs only"
echo "  ✓ HTTPS (443) — ALLOW from Cloudflare IPs only"
echo "  ✓ Everything else — DENY"
echo ""

log_warn "IMPORTANT: Your server is now only accessible via Cloudflare or SSH"
log_warn "Direct access (http://{SERVER_IP}) will be blocked"
echo ""

# Step 8: Create a cron job to auto-update Cloudflare IPs
log_info "Setting up daily Cloudflare IP update..."
CRON_CMD="0 2 * * * /root/Enterprise-Grade-E-commerce/infra/scripts/update-cloudflare-ips.sh >> /var/log/cloudflare-ips-update.log 2>&1"

# Check if cron job already exists
if ! (crontab -l 2>/dev/null | grep -q "update-cloudflare-ips.sh"); then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    log_success "Cron job added: updates Cloudflare IPs daily at 2 AM"
else
    log_success "Cron job already exists"
fi

echo ""
echo -e "${GREEN}All done!${NC}"
echo ""
echo "To temporarily allow your own IP for testing:"
echo -e "${BLUE}  ufw allow from YOUR_IP_HERE to any port 80${NC}"
echo ""
echo "To check firewall status later:"
echo -e "${BLUE}  sudo ufw status numbered${NC}"
echo ""
echo "To disable firewall (emergency):"
echo -e "${BLUE}  sudo ufw disable${NC}"
echo ""
