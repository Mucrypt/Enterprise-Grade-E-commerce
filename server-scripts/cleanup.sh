#!/bin/bash
# ===========================================
# Server-side: Docker Cleanup
# ===========================================
# Run on server: ./server-scripts/cleanup.sh
# Removes unused Docker resources
# ===========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Docker Cleanup"
echo "=========================================="
echo ""

log_info "Current disk usage:"
docker system df
echo ""

# Check if force flag is passed
if [ "$1" = "-f" ] || [ "$1" = "--force" ]; then
    FORCE=true
else
    FORCE=false
fi

if [ "$FORCE" = false ]; then
    log_warning "This will remove:"
    echo "  - All stopped containers"
    echo "  - All unused networks"  
    echo "  - All dangling images"
    echo "  - All build cache"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

log_info "Removing unused containers..."
docker container prune -f

log_info "Removing unused images..."
docker image prune -af

log_info "Removing unused volumes (except data volumes)..."
docker volume prune -f --filter "label!=keep"

log_info "Removing build cache..."
docker builder prune -af

echo ""
log_info "Disk usage after cleanup:"
docker system df

log_success "Cleanup complete!"
