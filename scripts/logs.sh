#!/bin/bash
# ===========================================
# View Production Logs
# ===========================================
# Usage: ./scripts/logs.sh [service] [lines]
# Examples:
#   ./scripts/logs.sh           - All logs (last 50 lines)
#   ./scripts/logs.sh api       - API logs
#   ./scripts/logs.sh admin 100 - Admin dashboard logs (100 lines)
# ===========================================

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"

SERVICE="${1:-api}"
LINES="${2:-50}"

case "$SERVICE" in
    api)       CONTAINER="techtools-api-prod" ;;
    admin)     CONTAINER="techtools-admin-dashboard-prod" ;;
    web)       CONTAINER="techtools-web-store-prod" ;;
    nginx)     CONTAINER="techtools-nginx-prod" ;;
    postgres)  CONTAINER="techtools-postgres-prod" ;;
    redis)     CONTAINER="techtools-redis-prod" ;;
    pgadmin)   CONTAINER="techtools-pgadmin-prod" ;;
    all)
        echo "=== API Logs ==="
        ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker logs techtools-api-prod --tail $LINES"
        echo ""
        echo "=== Admin Dashboard Logs ==="
        ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker logs techtools-admin-dashboard-prod --tail $LINES"
        echo ""
        echo "=== Nginx Logs ==="
        ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker logs techtools-nginx-prod --tail $LINES"
        exit 0
        ;;
    *)
        echo "Unknown service: $SERVICE"
        echo "Available: api, admin, web, nginx, postgres, redis, pgadmin, all"
        exit 1
        ;;
esac

echo "=== $SERVICE logs (last $LINES lines) ==="
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker logs $CONTAINER --tail $LINES"
