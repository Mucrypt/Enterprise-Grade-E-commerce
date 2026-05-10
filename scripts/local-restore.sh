#!/usr/bin/env bash
# ===========================================
# Local Machine Restore (Restic)
# ===========================================
# Usage:
#   ./scripts/local-restore.sh list
#   ./scripts/local-restore.sh restore latest /tmp/restore-home
#   ./scripts/local-restore.sh restore <snapshot-id> /tmp/restore-one ~/Enterprise-Grade-E-commerce
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
}

list_snapshots() {
  restic snapshots
}

restore_snapshot() {
  local snapshot="$1"
  local target_dir="$2"
  local include_path="${3:-}"

  mkdir -p "$target_dir"

  if [[ -n "$include_path" ]]; then
    log_info "Restoring snapshot '$snapshot' path '$include_path' -> '$target_dir'"
    restic restore "$snapshot" --target "$target_dir" --include "$include_path"
  else
    log_info "Restoring full snapshot '$snapshot' -> '$target_dir'"
    restic restore "$snapshot" --target "$target_dir"
  fi

  log_success "Restore completed: $target_dir"
}

usage() {
  cat <<EOF
Usage:
  $(basename "$0") list
  $(basename "$0") restore <snapshot|latest> <target-dir> [include-path]

Examples:
  $(basename "$0") list
  $(basename "$0") restore latest /tmp/full-restore
  $(basename "$0") restore 8f3b8a4d /tmp/project-only "$HOME/Enterprise-Grade-E-commerce"
EOF
}

main() {
  require_cmd restic
  load_config

  case "${1:-}" in
    list)
      list_snapshots
      ;;
    restore)
      if [[ $# -lt 3 ]]; then
        usage
        exit 1
      fi
      restore_snapshot "$2" "$3" "${4:-}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
