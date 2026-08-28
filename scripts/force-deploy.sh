#!/bin/bash
# ===========================================
# Force a rebuild/redeploy without a new commit
# ===========================================
# For when nothing changed in git but you need to redeploy anyway -- e.g.
# after changing a GitHub repo variable/secret, or re-running a flaky build.
# Triggers deploy-prod.yml's workflow_dispatch input directly.
#
# Usage:
#   ./scripts/force-deploy.sh              # auto: only rebuilds what path-filter detects changed
#   ./scripts/force-deploy.sh all
#   ./scripts/force-deploy.sh api
#   ./scripts/force-deploy.sh admin
#   ./scripts/force-deploy.sh web
# ===========================================

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "Not inside a git repository." >&2
    exit 1
fi
cd "$REPO_ROOT"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[force-deploy]${NC} $1"; }
log_success() { echo -e "${GREEN}[force-deploy]${NC} $1"; }
log_error() { echo -e "${RED}[force-deploy]${NC} $1"; }

command -v gh >/dev/null 2>&1 || { log_error "gh CLI not found -- https://cli.github.com"; exit 1; }

SERVICE="${1:-auto}"
case "$SERVICE" in
    auto|all|api|admin|web) ;;
    *)
        log_error "Unknown service: $SERVICE"
        echo "Usage: ./scripts/force-deploy.sh [auto|all|api|admin|web]"
        exit 1
        ;;
esac

BEFORE="$(gh run list --workflow=deploy-prod.yml --limit=1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")"

log_info "Dispatching deploy-prod.yml (service=$SERVICE)..."
gh workflow run deploy-prod.yml -f service="$SERVICE"

log_info "Waiting for the new run to register..."
RUN_ID=""
for _ in $(seq 1 15); do
    RUN_ID="$(gh run list --workflow=deploy-prod.yml --limit=1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")"
    [ -n "$RUN_ID" ] && [ "$RUN_ID" != "$BEFORE" ] && break
    RUN_ID=""
    sleep 2
done

if [ -z "$RUN_ID" ]; then
    log_error "Couldn't find the new run -- check manually: gh run list --workflow=deploy-prod.yml"
    exit 1
fi

log_info "Watching run $RUN_ID..."
if gh run watch "$RUN_ID" --exit-status; then
    log_success "Deployed."
else
    log_error "Run failed -- $(gh run view "$RUN_ID" --json url --jq .url)"
    log_error "See what broke: gh run view $RUN_ID --log-failed"
    exit 1
fi
