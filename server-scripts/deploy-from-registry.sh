#!/bin/bash
# ===========================================
# Server-side: Deploy pre-built images from GHCR
# ===========================================
# Run on server: ./server-scripts/deploy-from-registry.sh [admin|api|web|all]
# Called by .github/workflows/deploy-prod.yml over Tailscale SSH after CI
# has already built and pushed the image(s) -- this script never builds
# anything, it only pulls and swaps. That's the whole point of the
# registry-based pipeline: the ~75s build that used to run ON this server
# (competing with live traffic for the same CPU cores) now runs on
# GitHub's machines instead.
# ===========================================

set -e

cd /root/Enterprise-Grade-E-commerce
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"

# Accepts one or more of: admin api web all -- e.g. a single push that
# touched both tech-tools-api and admin-dashboard should deploy both,
# not just one (see .github/workflows/deploy-prod.yml's "which services"
# step, which passes exactly the set that actually built successfully).
ARGS=("${@:-all}")

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

SERVICES=""
for ARG in "${ARGS[@]}"; do
    case "$ARG" in
        admin) SERVICES="$SERVICES admin-dashboard" ;;
        api) SERVICES="$SERVICES api" ;;
        web) SERVICES="$SERVICES web-store" ;;
        all) SERVICES="api admin-dashboard web-store" ;;
        *)
            echo "Usage: ./server-scripts/deploy-from-registry.sh [admin] [api] [web] | [all]"
            exit 1
            ;;
    esac
done
# Dedupe in case the same service was named twice across multiple args.
SERVICES=$(echo "$SERVICES" | tr ' ' '\n' | sort -u | tr '\n' ' ')

log_info "Pulling latest changes..."
git pull origin main

log_info "Pulling new image(s) for: $SERVICES"
docker compose -f $COMPOSE_FILE pull $SERVICES

# No --force-recreate needed: `up -d` already recreates a container
# whenever the image it's using actually changed (a fresh pull gives it a
# new digest even though the tag is still `:latest`), and leaves it alone
# otherwise -- so re-running this for a service GHCR didn't actually
# rebuild is a safe no-op, not an unnecessary restart.
docker compose -f $COMPOSE_FILE up -d $SERVICES

# Run database migrations after an API deploy -- mirrors update.sh's
# existing behavior, so a migration that shipped with this deploy is
# never accidentally skipped.
if [[ "$SERVICES" == *"api"* ]]; then
    log_info "Running database migrations..."
    ./server-scripts/migrate.sh up
fi

# See nginx-reload.sh's own comment, and the api/admin-dashboard/web-store
# services above: nginx resolves their hostnames to an IP once at its own
# startup and never re-resolves on its own, so any container swap above
# needs a reload to actually take effect.
log_info "Reloading nginx so it picks up the new container(s)..."
./server-scripts/nginx-reload.sh

sleep 5
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep techtools

log_success "Deployed from registry: $SERVICES"
