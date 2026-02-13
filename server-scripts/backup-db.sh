#!/bin/bash
# ===========================================
# Server-side: Database Backup
# ===========================================
# Run on server: ./server-scripts/backup-db.sh
# Backups stored in /root/Enterprise-Grade-E-commerce/backups/
# ===========================================

set -e

BACKUP_DIR="/root/Enterprise-Grade-E-commerce/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="techtools_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
docker exec techtools-postgres-prod pg_dump -U techtools_user techtools_db > "$BACKUP_DIR/$BACKUP_FILE"

echo "Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Keep only last 30 backups
cd "$BACKUP_DIR"
ls -t techtools_backup_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --

echo ""
echo "Backup saved: $BACKUP_DIR/${BACKUP_FILE}.gz"
echo "Size: $(du -h "$BACKUP_DIR/${BACKUP_FILE}.gz" | cut -f1)"
echo ""
echo "Recent backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5
