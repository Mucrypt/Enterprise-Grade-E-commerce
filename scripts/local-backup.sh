#!/usr/bin/env bash
# ===========================================
# Local Machine Backup (Restic)
# ===========================================
# Safe-by-default: reads project files and writes snapshots to restic repo.
# Does not modify your project files.
#
# Usage:
#   ./scripts/local-backup.sh --init
#   ./scripts/local-backup.sh --run
#   ./scripts/local-backup.sh --check
#   ./scripts/local-backup.sh --dry-run
#
# Config:
#   BACKUP_CONFIG defaults to ~/.config/mukulah-backup.env
# ===========================================

set -euo pipefail
umask 077

BACKUP_CONFIG="${BACKUP_CONFIG:-$HOME/.config/mukulah-backup.env}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log_error "Missing required command: $1"
    exit 1
  }
}

load_config() {
  if [[ ! -f "$BACKUP_CONFIG" ]]; then
    log_error "Backup config not found: $BACKUP_CONFIG"
    echo "Run: ./scripts/setup-local-backup.sh"
    exit 1
  fi

  # shellcheck disable=SC1090
  source "$BACKUP_CONFIG"

  : "${BACKUP_REPO:?BACKUP_REPO is required in config}"
  : "${BACKUP_PASSWORD_FILE:?BACKUP_PASSWORD_FILE is required in config}"

  export RESTIC_REPOSITORY="$BACKUP_REPO"
  export RESTIC_PASSWORD_FILE="$BACKUP_PASSWORD_FILE"

  if [[ -z "${BACKUP_SOURCES:-}" ]]; then
    log_error "BACKUP_SOURCES is empty in $BACKUP_CONFIG"
    exit 1
  fi

  mapfile -t SOURCES < <(printf '%s\n' "$BACKUP_SOURCES" | sed '/^\s*$/d')

  EXCLUDES_FILE="${BACKUP_EXCLUDES_FILE:-$HOME/.config/mukulah-backup-excludes.txt}"
  KEEP_DAILY="${KEEP_DAILY:-14}"
  KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
  KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
  KEEP_YEARLY="${KEEP_YEARLY:-3}"

  HOST_TAG="${BACKUP_HOST_TAG:-$(hostname)}"
}

repo_exists() {
  restic snapshots >/dev/null 2>&1
}

init_repo() {
  if repo_exists; then
    log_warning "Restic repository already initialized"
    return 0
  fi

  log_info "Initializing restic repository..."
  restic init
  log_success "Repository initialized"
}

backup_run() {
  local -a backup_cmd

  backup_cmd=(
    restic backup
    "${SOURCES[@]}"
    --tag "host:${HOST_TAG}"
    --tag "profile:local-workstation"
    --exclude-caches
    --one-file-system
  )

  if [[ -f "$EXCLUDES_FILE" ]]; then
    backup_cmd+=(--exclude-file "$EXCLUDES_FILE")
  fi

  log_info "Running backup to: $RESTIC_REPOSITORY"
  "${backup_cmd[@]}"

  log_info "Applying retention policy..."
  restic forget --prune \
    --keep-daily "$KEEP_DAILY" \
    --keep-weekly "$KEEP_WEEKLY" \
    --keep-monthly "$KEEP_MONTHLY" \
    --keep-yearly "$KEEP_YEARLY"

  log_success "Backup and pruning completed"
}

dry_run() {
  local -a backup_cmd

  backup_cmd=(
    restic backup
    "${SOURCES[@]}"
    --tag "host:${HOST_TAG}"
    --tag "profile:local-workstation"
    --exclude-caches
    --one-file-system
    --dry-run
  )

  if [[ -f "$EXCLUDES_FILE" ]]; then
    backup_cmd+=(--exclude-file "$EXCLUDES_FILE")
  fi

  log_info "Dry-run backup to: $RESTIC_REPOSITORY"
  "${backup_cmd[@]}"
}

health_check() {
  log_info "Checking repository accessibility..."
  restic snapshots --compact | head -n 20

  log_info "Running lightweight integrity check (subset)..."
  restic check --read-data-subset=5%

  log_success "Backup health check completed"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [option]

Options:
  --init      Initialize restic repository
  --run       Run backup + retention pruning
  --dry-run   Preview backup set without creating snapshot
  --check     Validate repository and sample data integrity

Environment:
  BACKUP_CONFIG=/path/to/config.env
EOF
}

main() {
  require_cmd restic
  require_cmd sed

  load_config

  case "${1:-}" in
    --init)
      init_repo
      ;;
    --run)
      backup_run
      ;;
    --dry-run)
      dry_run
      ;;
    --check)
      health_check
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
