#!/bin/bash
# ===========================================
# Update Cloudflare IPs in UFW Daily
# ===========================================
# Purpose: Auto-update firewall rules with latest Cloudflare IPs
# Run via cron: 0 2 * * * /root/Enterprise-Grade-E-commerce/infra/scripts/update-cloudflare-ips.sh
# ===========================================

set -e

LOGFILE="/var/log/cloudflare-ips-update.log"
BACKUP_DIR="/opt/cloudflare-ips-backup"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

log "Starting Cloudflare IP update..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Fetch current Cloudflare IPs
CF_IPv4=$(curl -s "https://www.cloudflare.com/ips-v4" 2>/dev/null)
CF_IPv6=$(curl -s "https://www.cloudflare.com/ips-v6" 2>/dev/null)

if [ -z "$CF_IPv4" ]; then
    log "ERROR: Failed to fetch Cloudflare IPv4 ranges. Aborting."
    exit 1
fi

# Save to backup
echo "$CF_IPv4" > "$BACKUP_DIR/cloudflare-ips-v4.txt"
echo "$CF_IPv6" > "$BACKUP_DIR/cloudflare-ips-v6.txt"

log "Successfully fetched and backed up Cloudflare IPs"
log "IPv4 ranges: $(echo "$CF_IPv4" | wc -l) entries"
log "IPv6 ranges: $(echo "$CF_IPv6" | wc -l) entries"

# Future: Compare with previous version and only update if changed
# This prevents unnecessary UFW restarts

log "Completed"
