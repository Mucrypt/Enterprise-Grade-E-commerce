#!/bin/bash
# ===========================================
# Database Backup Script
# ===========================================
# Creates a backup of the production database
# Usage: ./scripts/backup.sh
# ===========================================

set -e

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"
REMOTE_DIR="/root/Enterprise-Grade-E-commerce"
LOCAL_BACKUP_DIR="./backups"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="techtools_backup_${TIMESTAMP}.sql"

# Create local backup directory
mkdir -p "$LOCAL_BACKUP_DIR"

log_info "Creating database backup..."

# Create backup on server
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker exec techtools-postgres-prod pg_dump -U techtools_user techtools_db > /tmp/$BACKUP_FILE"

log_info "Downloading backup..."

# Download backup
scp -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST:/tmp/$BACKUP_FILE" "$LOCAL_BACKUP_DIR/"

# Compress backup
gzip "$LOCAL_BACKUP_DIR/$BACKUP_FILE"

# Clean up remote temp file
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "rm /tmp/$BACKUP_FILE"

# Show backup size
BACKUP_SIZE=$(du -h "$LOCAL_BACKUP_DIR/${BACKUP_FILE}.gz" | cut -f1)

log_success "Backup complete!"
echo ""
echo "File: $LOCAL_BACKUP_DIR/${BACKUP_FILE}.gz"
echo "Size: $BACKUP_SIZE"
echo ""

# Keep only last 10 backups
cd "$LOCAL_BACKUP_DIR"
ls -t techtools_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm --
echo "Keeping last 10 backups"
