#!/bin/bash
# ===========================================
# Docker Cleanup Script
# ===========================================
# Cleans up unused Docker resources on production
# ===========================================

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Docker Cleanup - Production"
echo "=========================================="
echo ""

log_info "Current disk usage:"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker system df"

echo ""
log_warning "This will remove:"
echo "  - All stopped containers"
echo "  - All unused networks"
echo "  - All dangling images"
echo "  - All build cache"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Cleaning up Docker resources..."
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker system prune -af"
    
    echo ""
    log_info "Disk usage after cleanup:"
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker system df"
    
    log_success "Cleanup complete!"
else
    echo "Cancelled."
fi
