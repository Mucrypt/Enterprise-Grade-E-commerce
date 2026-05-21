#!/bin/bash
# ===========================================
# Local: pgAdmin SSH Tunnel Helper
# ===========================================
# Usage:
#   ./scripts/pgadmin-tunnel.sh start
#   ./scripts/pgadmin-tunnel.sh stop
#   ./scripts/pgadmin-tunnel.sh status
#   ./scripts/pgadmin-tunnel.sh open
# ===========================================

set -euo pipefail

SERVER_USER="${PGADMIN_SSH_USER:-root}"
SERVER_HOST="${PGADMIN_SSH_HOST:-100.92.116.9}"
SSH_KEY="${PGADMIN_SSH_KEY:-$HOME/.ssh/hetzner_nexusai}"
LOCAL_PORT="${PGADMIN_LOCAL_PORT:-5050}"
REMOTE_PORT="${PGADMIN_REMOTE_PORT:-5050}"
PID_FILE="${PGADMIN_TUNNEL_PID_FILE:-/tmp/techtools-pgadmin-tunnel.pid}"
LOG_FILE="${PGADMIN_TUNNEL_LOG_FILE:-/tmp/techtools-pgadmin-tunnel.log}"

is_listening() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1
  else
    ss -lnt 2>/dev/null | grep -q ":$LOCAL_PORT "
  fi
}

open_browser() {
  local url="http://localhost:$LOCAL_PORT"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
  echo "Open: $url"
}

start_tunnel() {
  if is_listening; then
    echo "Tunnel already active on localhost:$LOCAL_PORT"
    return 0
  fi

  if [[ ! -f "$SSH_KEY" ]]; then
    echo "SSH key not found: $SSH_KEY"
    exit 1
  fi

  echo "Starting pgAdmin tunnel on localhost:$LOCAL_PORT -> $SERVER_HOST:$REMOTE_PORT"
  ssh \
    -i "$SSH_KEY" \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -N \
    -L "$LOCAL_PORT:localhost:$REMOTE_PORT" \
    "$SERVER_USER@$SERVER_HOST" \
    >>"$LOG_FILE" 2>&1 &

  local pid=$!
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1 && is_listening; then
    echo "$pid" > "$PID_FILE"
    echo "Tunnel started (PID $pid)"
    open_browser
  else
    echo "Failed to start tunnel. See log: $LOG_FILE"
    tail -n 5 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi
}

stop_tunnel() {
  local stopped=false

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      stopped=true
    fi
    rm -f "$PID_FILE"
  fi

  pkill -f "ssh .*${LOCAL_PORT}:localhost:${REMOTE_PORT}.*${SERVER_USER}@${SERVER_HOST}" >/dev/null 2>&1 || true

  if is_listening; then
    echo "Tunnel still appears active on localhost:$LOCAL_PORT"
    exit 1
  fi

  if [[ "$stopped" == true ]]; then
    echo "Tunnel stopped"
  else
    echo "No active tunnel found"
  fi
}

status_tunnel() {
  if is_listening; then
    echo "Tunnel is active on localhost:$LOCAL_PORT"
    echo "URL: http://localhost:$LOCAL_PORT"
    if [[ -f "$PID_FILE" ]]; then
      echo "PID: $(cat "$PID_FILE")"
    fi
  else
    echo "Tunnel is not active"
    exit 1
  fi
}

case "${1:-}" in
  start)
    start_tunnel
    ;;
  stop)
    stop_tunnel
    ;;
  status)
    status_tunnel
    ;;
  open)
    open_browser
    ;;
  *)
    echo "Usage: ./scripts/pgadmin-tunnel.sh {start|stop|status|open}"
    exit 1
    ;;
esac
