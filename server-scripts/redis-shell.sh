#!/bin/bash
# ===========================================
# Server-side: Redis Shell
# ===========================================
# Run on server: ./server-scripts/redis-shell.sh
# Opens interactive Redis CLI
# ===========================================

echo "Connecting to Redis..."
docker exec -it techtools-redis-prod redis-cli
