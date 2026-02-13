#!/bin/bash
# ===========================================
# Server-side: Nginx Reload
# ===========================================
# Run on server: ./server-scripts/nginx-reload.sh
# Reloads nginx config without downtime
# ===========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Testing nginx configuration..."
if docker exec techtools-nginx-prod nginx -t 2>&1; then
    log_success "Configuration is valid"
    
    log_info "Reloading nginx..."
    docker exec techtools-nginx-prod nginx -s reload
    
    log_success "Nginx reloaded successfully!"
else
    log_error "Configuration test failed!"
    exit 1
fi
