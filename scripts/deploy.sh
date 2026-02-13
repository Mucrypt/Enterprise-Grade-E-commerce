#!/bin/bash
# ===========================================
# Production Deployment Script
# ===========================================
# Usage: ./scripts/deploy.sh [service]
# Examples:
#   ./scripts/deploy.sh           - Deploy all services
#   ./scripts/deploy.sh admin     - Deploy admin dashboard only
#   ./scripts/deploy.sh api       - Deploy API only
#   ./scripts/deploy.sh web       - Deploy web store only
# ===========================================

set -e

# Configuration
SERVER_USER="root"
SERVER_HOST="100.92.116.9"  # Tailscale IP
SSH_KEY="$HOME/.ssh/hetzner_nexusai"
REMOTE_DIR="/root/Enterprise-Grade-E-commerce"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ssh_cmd() {
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "$1"
}

# Determine which service to deploy
SERVICE="${1:-all}"

echo ""
echo "=========================================="
echo "  Production Deployment - nexusai.lt"
echo "=========================================="
echo ""

# Step 1: Push local changes
log_info "Pushing local changes to GitHub..."
git add -A
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || log_warning "No changes to commit"
git push origin main

# Step 2: Pull changes on server
log_info "Pulling changes on production server..."
ssh_cmd "cd $REMOTE_DIR && git pull origin main"

# Step 3: Build and deploy
case "$SERVICE" in
    admin)
        log_info "Building admin dashboard with API URL..."
        ssh_cmd "cd $REMOTE_DIR && docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/"
        
        log_info "Restarting admin dashboard..."
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d --force-recreate admin-dashboard"
        ;;
    
    api)
        log_info "Building and deploying API..."
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE build --no-cache api"
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d --force-recreate api"
        ;;
    
    web)
        log_info "Building and deploying web store..."
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE build --no-cache web-store"
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d --force-recreate web-store"
        ;;
    
    nginx)
        log_info "Restarting nginx..."
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE restart nginx"
        ;;
    
    all)
        log_info "Building all services..."
        
        # Build admin dashboard with build args
        ssh_cmd "cd $REMOTE_DIR && docker build --no-cache \
            --build-arg NEXT_PUBLIC_API_URL=https://nexusai.lt/api/v1 \
            --build-arg NEXT_PUBLIC_MEDIA_URL=https://nexusai.lt/media \
            --build-arg NEXT_PUBLIC_BASE_PATH=/admin \
            -t infrastructure-admin-dashboard:latest \
            -f admin-dashboard/Dockerfile admin-dashboard/"
        
        # Build other services
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE build api web-store"
        
        log_info "Deploying all services..."
        ssh_cmd "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d --force-recreate"
        ;;
    
    *)
        log_error "Unknown service: $SERVICE"
        echo "Usage: ./scripts/deploy.sh [admin|api|web|nginx|all]"
        exit 1
        ;;
esac

# Step 4: Verify deployment
log_info "Verifying deployment..."
sleep 5
ssh_cmd "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools"

# Step 5: Show logs if needed
echo ""
log_success "Deployment complete!"
echo ""
echo "URLs:"
echo "  - Store: https://nexusai.lt"
echo "  - Admin: https://nexusai.lt/admin/"
echo "  - API:   https://nexusai.lt/api/v1/health"
echo ""
