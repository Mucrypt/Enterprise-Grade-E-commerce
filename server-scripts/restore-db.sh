#!/bin/bash
# ===========================================
# Server-side: Database Restore
# ===========================================
# Run on server: ./server-scripts/restore-db.sh [backup_file]
# ===========================================

set -e

BACKUP_DIR="/root/Enterprise-Grade-E-commerce/backups"

if [ -z "$1" ]; then
    echo "Usage: ./server-scripts/restore-db.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo "Error: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no) " -r
echo ""

if [ "$REPLY" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo "Restoring database..."

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i techtools-postgres-prod psql -U techtools_user -d techtools_db
else
    docker exec -i techtools-postgres-prod psql -U techtools_user -d techtools_db < "$BACKUP_FILE"
fi

echo "Database restored successfully!"
