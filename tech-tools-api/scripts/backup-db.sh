#!/bin/bash

# Database backup script

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/techtools_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."

# Create backup
pg_dump -h localhost -p 5432 -U techtools_user -d techtools -F c -b -v -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup created successfully: $BACKUP_FILE"
  
  # Keep only last 7 backups
  ls -t $BACKUP_DIR/techtools_backup_*.sql | tail -n +8 | xargs rm -f
  
  echo "Old backups cleaned up"
else
  echo "Backup failed!"
  exit 1
fi