#!/bin/bash
# ===========================================
# Server-side: Rebuild and Deploy Service
# ===========================================
# Run on server: ./server-scripts/rebuild.sh [service]
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

SERVICE="${1:-all}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# nginx's upstream blocks (nginx/nginx.prod.conf) resolve the api/
# admin-dashboard/web-store container hostnames to an IP ONCE, at nginx
# startup -- there's no `resolver` directive, so it never re-resolves on
# its own. Recreating one of those containers gives it a new internal
# Docker IP, and nginx keeps sending traffic to the old, now-dead one
# until it's reloaded. This is a graceful reload (workers restart
# cleanly, no dropped connections), not a restart -- it must run after
# ANY of those three containers gets recreated below. Reuses the existing
# nginx-reload.sh (config-tests before reloading) rather than duplicating
# that logic here.
reload_nginx() {
    ./server-scripts/nginx-reload.sh
}

log_info "Pulling latest changes..."
git pull origin main

case "$SERVICE" in
    admin)
        log_info "Building admin dashboard..."
        docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://techtoolstore.com/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://techtoolstore.com/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t ghcr.io/mucrypt/enterprise-grade-e-commerce-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/

        log_info "Restarting admin dashboard..."
        docker compose -f $COMPOSE_FILE up -d --force-recreate admin-dashboard
        reload_nginx
        ;;

    api)
        log_info "Building and deploying API..."
        docker compose -f $COMPOSE_FILE build --no-cache api
        docker compose -f $COMPOSE_FILE up -d --force-recreate api
        reload_nginx
        ;;

    web)
        log_info "Building and deploying web store..."
        docker compose -f $COMPOSE_FILE build --no-cache web-store
        docker compose -f $COMPOSE_FILE up -d --force-recreate web-store
        reload_nginx
        ;;

    all)
        log_info "Building all services..."

        docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://techtoolstore.com/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://techtoolstore.com/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t ghcr.io/mucrypt/enterprise-grade-e-commerce-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/

        docker compose -f $COMPOSE_FILE build api web-store

        # Only force-recreate the 3 services actually just rebuilt.
        # Previously this ran `up -d --force-recreate` with no service
        # list, which restarts EVERY container -- nginx (the site's only
        # entry point), postgres, and redis included, even though none of
        # them changed. That's what took the whole site down on every
        # deploy, not just the service being updated.
        docker compose -f $COMPOSE_FILE up -d --force-recreate admin-dashboard api web-store
        reload_nginx
        ;;

    *)
        echo "Usage: ./server-scripts/rebuild.sh [admin|api|web|all]"
        exit 1
        ;;
esac

sleep 5
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools

log_success "Done!"
