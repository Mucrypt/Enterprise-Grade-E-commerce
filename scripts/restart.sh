#!/bin/bash
# ===========================================
# Restart Production Services
# ===========================================
# Usage: ./scripts/restart.sh [service]
# Examples:
#   ./scripts/restart.sh         - Restart all
#   ./scripts/restart.sh api     - Restart API only
#   ./scripts/restart.sh admin   - Restart admin only
# ===========================================

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"
REMOTE_DIR="/root/Enterprise-Grade-E-commerce"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

SERVICE="${1:-all}"

case "$SERVICE" in
    api)     CONTAINERS="api" ;;
    admin)   CONTAINERS="admin-dashboard" ;;
    web)     CONTAINERS="web-store" ;;
    nginx)   CONTAINERS="nginx" ;;
    db)      CONTAINERS="postgres redis" ;;
    all)     CONTAINERS="api admin-dashboard web-store nginx" ;;
    *)
        echo "Unknown service: $SERVICE"
        echo "Available: api, admin, web, nginx, db, all"
        exit 1
        ;;
esac

log_info "Restarting $SERVICE..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE restart $CONTAINERS"

sleep 3
log_info "Current status:"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools"

log_success "Restart complete!"
