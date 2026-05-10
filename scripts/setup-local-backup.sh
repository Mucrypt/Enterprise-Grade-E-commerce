#!/usr/bin/env bash
# ===========================================
# Local Backup Setup (Non-destructive)
# ===========================================
# Creates config and excludes for restic backups.
# Optional: install a user-level systemd timer.
# ===========================================

set -euo pipefail
umask 077

CONFIG_DIR="$HOME/.config"
BACKUP_CONFIG="$CONFIG_DIR/mukulah-backup.env"
EXCLUDES_FILE="$CONFIG_DIR/mukulah-backup-excludes.txt"
PASSWORD_FILE="$CONFIG_DIR/mukulah-restic-password.txt"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

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

ensure_config_dir() {
  mkdir -p "$CONFIG_DIR"
}

create_password_file() {
  if [[ -f "$PASSWORD_FILE" ]]; then
    log_warning "Password file already exists: $PASSWORD_FILE"
    return 0
  fi

  local generated
  generated="$(tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' </dev/urandom | head -c 48 || true)"
  if [[ -z "$generated" ]]; then
    log_error "Failed to generate password"
    exit 1
  fi

  printf '%s\n' "$generated" > "$PASSWORD_FILE"
  chmod 600 "$PASSWORD_FILE"
  log_success "Created restic password file: $PASSWORD_FILE"
}

create_excludes_file() {
  if [[ -f "$EXCLUDES_FILE" ]]; then
    log_warning "Exclude file already exists: $EXCLUDES_FILE"
    return 0
  fi

  cat > "$EXCLUDES_FILE" <<'EOF'
# Build and dependency caches
**/node_modules
**/.next
**/dist
**/build
**/.cache
**/.expo
**/.gradle
**/coverage

# VCS internals
**/.git

# Large local transient folders
**/tmp
**/.venv
**/venv
EOF

  chmod 600 "$EXCLUDES_FILE"
  log_success "Created exclude file: $EXCLUDES_FILE"
}

create_backup_config() {
  if [[ -f "$BACKUP_CONFIG" ]]; then
    log_warning "Backup config already exists: $BACKUP_CONFIG"
    log_info "Edit it manually if you need changes"
    return 0
  fi

  cat > "$BACKUP_CONFIG" <<EOF
# Restic repository target examples:
#  - Local disk: BACKUP_REPO=/mnt/backups/restic-repo
#  - S3 bucket:  BACKUP_REPO=s3:s3.amazonaws.com/your-bucket-name/restic
#  - B2 bucket:  BACKUP_REPO=b2:your-bucket:restic
BACKUP_REPO=/mnt/backups/restic-repo
BACKUP_PASSWORD_FILE=$PASSWORD_FILE

# One source path per line (quoted as a multiline variable)
BACKUP_SOURCES="
$HOME/Enterprise-Grade-E-commerce
$HOME/Web-Apps-Projects
$HOME/python-projects
$HOME/.ssh
$HOME/.config
"

BACKUP_EXCLUDES_FILE=$EXCLUDES_FILE
BACKUP_HOST_TAG=$(hostname)

# Retention policy
KEEP_DAILY=14
KEEP_WEEKLY=8
KEEP_MONTHLY=12
KEEP_YEARLY=3
EOF

  chmod 600 "$BACKUP_CONFIG"
  log_success "Created backup config: $BACKUP_CONFIG"
}

install_timer() {
  mkdir -p "$SYSTEMD_USER_DIR"

  cat > "$SYSTEMD_USER_DIR/mukulah-local-backup.service" <<EOF
[Unit]
Description=Mukulah local restic backup

[Service]
Type=oneshot
ExecStart=%h/Enterprise-Grade-E-commerce/scripts/local-backup.sh --run
Environment=BACKUP_CONFIG=%h/.config/mukulah-backup.env
EOF

  cat > "$SYSTEMD_USER_DIR/mukulah-local-backup.timer" <<'EOF'
[Unit]
Description=Run local backup twice daily

[Timer]
OnCalendar=*-*-* 08,20:00:00
Persistent=true
RandomizedDelaySec=20m

[Install]
WantedBy=timers.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now mukulah-local-backup.timer
  log_success "Installed and started user timer: mukulah-local-backup.timer"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--install-timer]

What it does:
  - Creates $BACKUP_CONFIG (if missing)
  - Creates $EXCLUDES_FILE (if missing)
  - Creates $PASSWORD_FILE (if missing)

Optional:
  --install-timer   Installs user-level systemd timer for automatic backups
EOF
}

main() {
  require_cmd hostname
  require_cmd systemctl

  ensure_config_dir
  create_password_file
  create_excludes_file
  create_backup_config

  if [[ "${1:-}" == "--install-timer" ]]; then
    install_timer
  elif [[ -n "${1:-}" ]]; then
    usage
    exit 1
  fi

  echo
  log_info "Next steps:"
  echo "  1) Edit $BACKUP_CONFIG and set BACKUP_REPO"
  echo "  2) Initialize repo: ./scripts/local-backup.sh --init"
  echo "  3) Dry run:         ./scripts/local-backup.sh --dry-run"
  echo "  4) First backup:    ./scripts/local-backup.sh --run"
  echo "  5) Health check:    ./scripts/local-backup.sh --check"
}

main "$@"
