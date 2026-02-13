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

log_info "Pulling latest changes..."
git pull origin main

case "$SERVICE" in
    admin)
        log_info "Building admin dashboard..."
        docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/
        
        log_info "Restarting admin dashboard..."
        docker compose -f $COMPOSE_FILE up -d --force-recreate admin-dashboard
        ;;
    
    api)
        log_info "Building and deploying API..."
        docker compose -f $COMPOSE_FILE build --no-cache api
        docker compose -f $COMPOSE_FILE up -d --force-recreate api
        ;;
    
    web)
        log_info "Building and deploying web store..."
        docker compose -f $COMPOSE_FILE build --no-cache web-store
        docker compose -f $COMPOSE_FILE up -d --force-recreate web-store
        ;;
    
    all)
        log_info "Building all services..."
        
        docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/
        
        docker compose -f $COMPOSE_FILE build api web-store
        docker compose -f $COMPOSE_FILE up -d --force-recreate
        ;;
    
    *)
        echo "Usage: ./server-scripts/rebuild.sh [admin|api|web|all]"
        exit 1
        ;;
esac

sleep 5
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools

log_success "Done!"
