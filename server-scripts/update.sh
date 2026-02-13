#!/bin/bash
# ===========================================
# Server-side: Full Update
# ===========================================
# Run on server: ./server-scripts/update.sh [service]
# Pulls, rebuilds, and restarts services
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

SERVICE="${1:-all}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Full Update - $SERVICE"
echo "=========================================="
echo ""

# Step 1: Pull
log_info "Step 1/3: Pulling latest changes..."
git pull origin main

# Step 2: Build
log_info "Step 2/3: Building $SERVICE..."

case "$SERVICE" in
    admin)
        docker build \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/
        ;;
    
    api)
        docker compose -f $COMPOSE_FILE build api
        ;;
    
    web)
        docker compose -f $COMPOSE_FILE build web-store
        ;;
    
    all)
        # Build admin with build args
        docker build \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/
        
        # Build other services
        docker compose -f $COMPOSE_FILE build api web-store
        ;;
    
    *)
        log_error "Unknown service: $SERVICE"
        echo "Usage: ./server-scripts/update.sh [admin|api|web|all]"
        exit 1
        ;;
esac

# Step 3: Deploy
log_info "Step 3/3: Deploying $SERVICE..."

case "$SERVICE" in
    admin)
        docker compose -f $COMPOSE_FILE up -d --force-recreate admin-dashboard
        ;;
    api)
        docker compose -f $COMPOSE_FILE up -d --force-recreate api
        ;;
    web)
        docker compose -f $COMPOSE_FILE up -d --force-recreate web-store
        ;;
    all)
        docker compose -f $COMPOSE_FILE up -d --force-recreate api admin-dashboard web-store
        ;;
esac

# Wait for containers to be healthy
log_info "Waiting for services to be healthy..."
sleep 10

# Show status
echo ""
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools

echo ""
log_success "Update complete!"
