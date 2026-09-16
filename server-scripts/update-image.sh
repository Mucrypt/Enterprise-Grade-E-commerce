#!/bin/bash
# ===========================================
# Server-side: Update a Third-Party Image
# ===========================================
# Run on server: ./server-scripts/update-image.sh <service>
#
# For services pulled from a registry rather than built from this repo's
# source (postgres, redis, nginx, pgadmin, certbot). Their `:latest`/major
# tag in docker-compose.prod.yml doesn't auto-update -- the image on the
# server only moves forward when it's re-pulled. This does that, then
# recreates just that one container so it starts from the new image.
#
# Safe to run any time: each of these services keeps its real state in a
# volume or bind mount (pgadmin_data, postgres_prod_data, the nginx config
# bind mount, etc.), not in the container itself, so recreating it doesn't
# lose anything.
#
# api / admin-dashboard / web-store are built from this repo's own source,
# not pulled -- use update.sh for those instead.
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

SERVICE="$1"
VALID_SERVICES="postgres redis nginx pgadmin certbot"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "$SERVICE" ] || ! echo " $VALID_SERVICES " | grep -q " $SERVICE "; then
    log_error "Usage: ./server-scripts/update-image.sh <service>"
    echo "  <service> must be one of: $VALID_SERVICES"
    echo ""
    echo "  (api / admin-dashboard / web-store are built from this repo's"
    echo "  source, not pulled from a registry -- use update.sh for those.)"
    exit 1
fi

echo ""
echo "=========================================="
echo "  Update Image - $SERVICE"
echo "=========================================="
echo ""

log_info "Pulling latest $SERVICE image..."
docker compose -f "$COMPOSE_FILE" pull "$SERVICE"

log_info "Recreating $SERVICE container..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE"

log_info "Waiting for it to come up..."
sleep 5

echo ""
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep "techtools-$SERVICE" || true

echo ""
log_success "$SERVICE updated to the latest pulled image!"
