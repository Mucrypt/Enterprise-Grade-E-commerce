#!/bin/bash
# ===========================================
# Server-side: View Logs
# ===========================================
# Run on server: ./server-scripts/logs.sh [service] [lines]
# ===========================================

SERVICE="${1:-api}"
LINES="${2:-50}"
FOLLOW="${3:-}"

case "$SERVICE" in
    api)       CONTAINER="techtools-api-prod" ;;
    admin)     CONTAINER="techtools-admin-dashboard-prod" ;;
    web)       CONTAINER="techtools-web-store-prod" ;;
    nginx)     CONTAINER="techtools-nginx-prod" ;;
    postgres)  CONTAINER="techtools-postgres-prod" ;;
    redis)     CONTAINER="techtools-redis-prod" ;;
    pgadmin)   CONTAINER="techtools-pgadmin-prod" ;;
    *)
        echo "Available: api, admin, web, nginx, postgres, redis, pgadmin"
        exit 1
        ;;
esac

if [ "$FOLLOW" = "-f" ]; then
    docker logs -f "$CONTAINER" --tail "$LINES"
else
    docker logs "$CONTAINER" --tail "$LINES"
fi
