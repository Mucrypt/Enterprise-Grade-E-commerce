#!/bin/bash
# ===========================================
# Server-side: SSL Certificate Renewal
# ===========================================
# Run on server: ./server-scripts/ssl-renew.sh
# Renews Let's Encrypt certificates
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
echo "  SSL Certificate Renewal"
echo "=========================================="
echo ""

log_info "Current certificate info:"
docker exec techtools-certbot certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry Date" || echo "  No certificates found"

echo ""
log_info "Attempting renewal..."
docker exec techtools-certbot certbot renew --dry-run

if [ $? -eq 0 ]; then
    log_success "Dry run successful!"
    echo ""
    read -p "Proceed with actual renewal? (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Renewing certificates..."
        docker exec techtools-certbot certbot renew
        
        log_info "Reloading nginx..."
        docker exec techtools-nginx-prod nginx -s reload
        
        log_success "SSL renewal complete!"
    else
        echo "Cancelled."
    fi
else
    log_warning "Dry run failed - certificates may not need renewal yet"
fi
