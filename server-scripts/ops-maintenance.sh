#!/bin/bash
# ===========================================
# Server-side: Ops Maintenance Utilities
# ===========================================
# Run on server: ./server-scripts/ops-maintenance.sh <command>
# ===========================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ROOT_DIR="/root/Enterprise-Grade-E-commerce"
COMPOSE_FILE="$ROOT_DIR/infrastructure/docker-compose.prod.yml"
CRON_LINE="0 3 * * 0 /usr/bin/docker builder prune -af >/var/log/docker-builder-prune.log 2>&1"

usage() {
  cat <<EOF
Usage: ./server-scripts/ops-maintenance.sh <command>

Commands:
  pgadmin-stop     Stop pgAdmin container (saves RAM)
  pgadmin-start    Start pgAdmin container
  pgadmin-status   Show pgAdmin container status
  cron-install     Install weekly Docker cache-prune cron (idempotent)
  cron-remove      Remove weekly Docker cache-prune cron
  cron-status      Show crontab and whether prune job exists
  apply-safe       Run pgadmin-stop + cron-install in one safe pass
  all-status       Show pgAdmin, cron, memory, and disk summary
EOF
}

ensure_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
  fi
}

pgadmin_stop() {
  ensure_compose_file
  log_info "Stopping pgAdmin..."
  docker compose -f "$COMPOSE_FILE" stop pgadmin
  log_success "pgAdmin stopped"
}

pgadmin_start() {
  ensure_compose_file
  log_info "Starting pgAdmin..."
  docker compose -f "$COMPOSE_FILE" start pgadmin
  log_success "pgAdmin started"
}

pgadmin_status() {
  log_info "pgAdmin status:"
  docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'techtools-pgadmin-prod|NAMES' || true
}

cron_install() {
  log_info "Installing weekly Docker cache-prune cron (idempotent)..."
  local tmp
  tmp=$(mktemp)
  crontab -l 2>/dev/null > "$tmp" || true
  if ! grep -Fq "$CRON_LINE" "$tmp"; then
    echo "$CRON_LINE" >> "$tmp"
    crontab "$tmp"
    log_success "Cron job installed"
  else
    log_warning "Cron job already present"
  fi
  rm -f "$tmp"
}

cron_remove() {
  log_info "Removing weekly Docker cache-prune cron (if present)..."
  local tmp
  tmp=$(mktemp)
  crontab -l 2>/dev/null | grep -Fv "$CRON_LINE" > "$tmp" || true
  crontab "$tmp"
  rm -f "$tmp"
  log_success "Cron job removed (if it existed)"
}

cron_status() {
  log_info "Current crontab:"
  crontab -l 2>/dev/null || echo "(empty)"
  echo ""
  if crontab -l 2>/dev/null | grep -Fq "$CRON_LINE"; then
    log_success "Weekly Docker cache-prune cron is installed"
  else
    log_warning "Weekly Docker cache-prune cron is NOT installed"
  fi
}

all_status() {
  pgadmin_status
  echo ""
  cron_status
  echo ""
  log_info "Memory summary:"
  free -h | sed -n '1,2p'
  echo ""
  log_info "Disk summary:"
  df -h / | tail -n 1
}

apply_safe() {
  pgadmin_stop
  cron_install
  echo ""
  all_status
}

CMD="${1:-}"

case "$CMD" in
  pgadmin-stop) pgadmin_stop ;;
  pgadmin-start) pgadmin_start ;;
  pgadmin-status) pgadmin_status ;;
  cron-install) cron_install ;;
  cron-remove) cron_remove ;;
  cron-status) cron_status ;;
  apply-safe) apply_safe ;;
  all-status) all_status ;;
  -h|--help|help|"") usage ;;
  *)
    log_error "Unknown command: $CMD"
    usage
    exit 1
    ;;
esac
