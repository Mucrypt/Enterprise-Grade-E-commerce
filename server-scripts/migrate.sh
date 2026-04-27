#!/bin/bash
# ===========================================
# Server-side: Database Migration Script
# ===========================================
# Run on server: ./server-scripts/migrate.sh [up|down|status|force]
# Runs migrations inside the API container
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce

# Configuration
POSTGRES_CONTAINER="techtools-postgres-prod"
API_CONTAINER="techtools-api-prod"
MIGRATIONS_DIR="tech-tools-api/src/database/migrations"
DB_USER="${DB_USER:-}"
DB_NAME="${DB_NAME:-}"

# Read a single KEY=value from .env without evaluating shell content.
read_env_value() {
    local key="$1"
    local env_file=".env"

    [ -f "$env_file" ] || return 1

    local line
    line=$(grep -E "^${key}=" "$env_file" | tail -n 1) || return 1
    line="${line#*=}"

    # Trim surrounding quotes if present.
    line="${line%\"}"
    line="${line#\"}"
    line="${line%\'}"
    line="${line#\'}"

    printf '%s' "$line"
}

# Load only DB vars used by this script.
if [ -z "$DB_USER" ]; then
    DB_USER="$(read_env_value DB_USER 2>/dev/null || true)"
fi
if [ -z "$DB_NAME" ]; then
    DB_NAME="$(read_env_value DB_NAME 2>/dev/null || true)"
fi

DB_USER="${DB_USER:-techtools_user}"
DB_NAME="${DB_NAME:-techtools}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

COMMAND="${1:-up}"

echo ""
echo "=========================================="
echo "  Database Migration - $COMMAND"
echo "=========================================="
echo ""

# Check if postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log_error "PostgreSQL container '$POSTGRES_CONTAINER' is not running!"
    echo "Start it with: docker compose -f infrastructure/docker-compose.prod.yml up -d postgres"
    exit 1
fi

# Function to run SQL
run_sql() {
    docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME "$@"
}

# Ensure migrations tracking table exists
ensure_migrations_table() {
    log_info "Ensuring migrations tracking table exists..."
    run_sql <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF
}

# Get executed migrations
get_executed_migrations() {
    run_sql -t -A -c "SELECT filename FROM schema_migrations ORDER BY id"
}

# Get migration files
get_migration_files() {
    ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | xargs -n1 basename | sort
}

# Run a single migration
run_migration() {
    local filename=$1
    local filepath="$MIGRATIONS_DIR/$filename"
    
    log_info "Running: $filename"
    
    # Execute migration
    if cat "$filepath" | run_sql; then
        # Record migration
        run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('$filename')" >/dev/null 2>&1
        log_success "Executed: $filename"
        return 0
    else
        log_error "Failed: $filename"
        return 1
    fi
}

# Migration up
migrate_up() {
    ensure_migrations_table
    
    local executed=$(get_executed_migrations)
    local migration_files=$(get_migration_files)
    local pending=0
    local executed_count=0
    
    log_info "Checking for pending migrations..."
    echo ""
    
    for file in $migration_files; do
        if echo "$executed" | grep -q "^${file}$"; then
            echo -e "  ${GREEN}✓${NC} $file (already executed)"
            executed_count=$((executed_count + 1))
        else
            echo -e "  ${YELLOW}⏳${NC} $file (pending)"
            pending=$((pending + 1))
        fi
    done
    
    echo ""
    
    if [ $pending -eq 0 ]; then
        log_success "No pending migrations. Database is up to date!"
        return 0
    fi
    
    log_info "Running $pending pending migration(s)..."
    echo ""
    
    for file in $migration_files; do
        if ! echo "$executed" | grep -q "^${file}$"; then
            if ! run_migration "$file"; then
                log_error "Migration failed! Stopping."
                exit 1
            fi
        fi
    done
    
    echo ""
    log_success "All migrations completed successfully!"
}

# Migration down (rollback last)
migrate_down() {
    ensure_migrations_table
    
    local last_migration=$(run_sql -t -A -c "SELECT filename FROM schema_migrations ORDER BY id DESC LIMIT 1")
    
    if [ -z "$last_migration" ]; then
        log_warning "No migrations to rollback."
        return 0
    fi
    
    log_warning "Rolling back: $last_migration"
    log_warning "Note: This only removes the tracking record. You may need to manually undo SQL changes."
    
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "Rollback cancelled."
        return 0
    fi
    
    run_sql -c "DELETE FROM schema_migrations WHERE filename = '$last_migration'" >/dev/null 2>&1
    log_success "Rolled back: $last_migration"
}

# Migration status
migrate_status() {
    ensure_migrations_table
    
    local executed=$(get_executed_migrations)
    local migration_files=$(get_migration_files)
    local total=0
    local done=0
    
    echo ""
    echo "Migration Status:"
    echo "─────────────────────────────────────────"
    
    for file in $migration_files; do
        total=$((total + 1))
        if echo "$executed" | grep -q "^${file}$"; then
            echo -e "  ${GREEN}✓${NC} $file"
            done=$((done + 1))
        else
            echo -e "  ${YELLOW}○${NC} $file"
        fi
    done
    
    echo "─────────────────────────────────────────"
    echo -e "  Executed: ${done}/${total}"
    echo ""
}

# Force run a specific migration (even if already recorded)
migrate_force() {
    local filename=$2
    
    if [ -z "$filename" ]; then
        log_error "Usage: ./server-scripts/migrate.sh force <filename>"
        echo "Example: ./server-scripts/migrate.sh force 006_coupons_and_reviews.sql"
        exit 1
    fi
    
    local filepath="$MIGRATIONS_DIR/$filename"
    
    if [ ! -f "$filepath" ]; then
        log_error "Migration file not found: $filepath"
        exit 1
    fi
    
    log_warning "Force running migration: $filename"
    log_warning "This will run the SQL regardless of tracking status."
    
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "Cancelled."
        return 0
    fi
    
    ensure_migrations_table
    
    log_info "Executing: $filename"
    if cat "$filepath" | run_sql; then
        # Update or insert tracking record
        run_sql -c "DELETE FROM schema_migrations WHERE filename = '$filename'" >/dev/null 2>&1
        run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('$filename')" >/dev/null 2>&1
        log_success "Force executed: $filename"
    else
        log_error "Failed: $filename"
        exit 1
    fi
}

# Main
case "$COMMAND" in
    up)
        migrate_up
        ;;
    down)
        migrate_down
        ;;
    status)
        migrate_status
        ;;
    force)
        migrate_force "$@"
        ;;
    *)
        echo "Usage: ./server-scripts/migrate.sh [up|down|status|force]"
        echo ""
        echo "Commands:"
        echo "  up      - Run all pending migrations (default)"
        echo "  down    - Rollback last migration"
        echo "  status  - Show migration status"
        echo "  force   - Force run a specific migration file"
        echo ""
        echo "Examples:"
        echo "  ./server-scripts/migrate.sh up"
        echo "  ./server-scripts/migrate.sh status"
        echo "  ./server-scripts/migrate.sh force 006_coupons_and_reviews.sql"
        exit 1
        ;;
esac
