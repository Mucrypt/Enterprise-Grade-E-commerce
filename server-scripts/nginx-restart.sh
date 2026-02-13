#!/bin/bash
# ===========================================
# Server-side: Nginx Restart
# ===========================================
# Run on server: ./server-scripts/nginx-restart.sh
# Restarts nginx container (picks up new container IPs)
# ===========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

COMPOSE_FILE="/root/Enterprise-Grade-E-commerce/infrastructure/docker-compose.prod.yml"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Nginx Restart"
echo "=========================================="
echo ""

log_info "Restarting nginx container..."
docker compose -f "$COMPOSE_FILE" restart nginx

if [ $? -eq 0 ]; then
    log_success "Nginx restarted successfully!"
    echo ""
    log_info "Checking nginx status..."
    docker ps --filter "name=techtools-nginx-prod" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    log_error "Failed to restart nginx!"
    exit 1
fi
