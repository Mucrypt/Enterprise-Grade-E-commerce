#!/bin/bash
# ===========================================
# Quick Deploy - Push only changes (no rebuild)
# ===========================================
# Use this when you've made small changes that don't require rebuilding
# For example: text changes, config updates, etc.
# ===========================================

set -e

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"
REMOTE_DIR="/root/Enterprise-Grade-E-commerce"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

ssh_cmd() {
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "$1"
}

SERVICE="${1:-all}"

log_info "Pushing changes..."
git add -A
git commit -m "Quick deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || echo "No changes to commit"
git push origin main

log_info "Pulling on server..."
ssh_cmd "cd $REMOTE_DIR && git pull origin main"

if [ "$SERVICE" != "none" ]; then
    log_info "Restarting $SERVICE..."
    if [ "$SERVICE" = "all" ]; then
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE restart api admin-dashboard web-store nginx"
    else
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE restart $SERVICE"
    fi
fi

log_success "Quick deploy complete!"
