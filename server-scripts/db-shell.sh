#!/bin/bash
# ===========================================
# Server-side: Database Shell
# ===========================================
# Run on server: ./server-scripts/db-shell.sh
# Opens interactive PostgreSQL shell
# ===========================================

echo "Connecting to techtools_db..."
docker exec -it techtools-postgres-prod psql -U techtools_user -d techtools_db
