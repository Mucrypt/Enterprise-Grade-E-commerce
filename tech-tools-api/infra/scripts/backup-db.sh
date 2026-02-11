#!/bin/bash

# Database Backup Script

set -e

BACKUP_DIR="./infra/docker/production/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="techtools_backup_${TIMESTAMP}.sql"

echo "💾 Creating database backup..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
cd infra/docker/production
docker-compose exec -T postgres pg_dump -U ${DB_USER} ${DB_NAME} > $BACKUP_DIR/$BACKUP_FILE

# Compress backup
gzip $BACKUP_DIR/$BACKUP_FILE

echo "✅ Backup created: $BACKUP_DIR/${BACKUP_FILE}.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "techtools_backup_*.sql.gz" -mtime +7 -delete

echo "🧹 Old backups cleaned up (keeping last 7 days)"
