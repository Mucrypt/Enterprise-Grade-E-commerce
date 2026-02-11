#!/bin/bash

# Database Restore Script

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore-db.sh <backup-file>"
    echo "Example: ./restore-db.sh techtools_backup_20260209_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Are you sure you want to restore from $BACKUP_FILE? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "📥 Restoring database from $BACKUP_FILE..."

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | docker-compose exec -T postgres psql -U ${DB_USER} ${DB_NAME}
else
    cat $BACKUP_FILE | docker-compose exec -T postgres psql -U ${DB_USER} ${DB_NAME}
fi

echo "✅ Database restored successfully!"
