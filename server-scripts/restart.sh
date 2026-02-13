#!/bin/bash
# ===========================================
# Server-side: Quick Restart Services
# ===========================================
# Run on server: ./server-scripts/restart.sh [service]
# ===========================================

cd /root/Enterprise-Grade-E-commerce
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

SERVICE="${1:-all}"

case "$SERVICE" in
    api)     docker compose -f $COMPOSE_FILE restart api ;;
    admin)   docker compose -f $COMPOSE_FILE restart admin-dashboard ;;
    web)     docker compose -f $COMPOSE_FILE restart web-store ;;
    nginx)   docker compose -f $COMPOSE_FILE restart nginx ;;
    db)      docker compose -f $COMPOSE_FILE restart postgres redis ;;
    all)     docker compose -f $COMPOSE_FILE restart api admin-dashboard web-store nginx ;;
    *)
        echo "Usage: ./server-scripts/restart.sh [api|admin|web|nginx|db|all]"
        exit 1
        ;;
esac

echo ""
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools
