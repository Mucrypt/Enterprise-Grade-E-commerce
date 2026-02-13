#!/bin/bash
# ===========================================
# Server-side: Pull Latest Changes
# ===========================================
# Run on server: ./server-scripts/pull.sh
# Just pulls code without rebuilding
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Pull Latest Changes"
echo "=========================================="
echo ""

log_info "Current commit:"
git log --oneline -1

echo ""
log_info "Fetching from origin..."
git fetch origin main

# Check if there are changes
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warning "Already up to date!"
    exit 0
fi

echo ""
log_info "Changes to pull:"
git log --oneline HEAD..origin/main

echo ""
log_info "Pulling changes..."
git pull origin main

echo ""
log_success "Pull complete!"
echo ""
log_info "New commit:"
git log --oneline -1

echo ""
echo "Next steps:"
echo "  - Rebuild services:   ./server-scripts/rebuild.sh [admin|api|web|all]"
echo "  - Quick restart:      ./server-scripts/restart.sh [service]"
echo ""
