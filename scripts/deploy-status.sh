#!/bin/bash
# ===========================================
# Recent deploy history
# ===========================================
# What's actually happened in CI/CD lately -- complements status.sh, which
# checks live server/container health instead. Usage:
#   ./scripts/deploy-status.sh          # last 5 runs
#   ./scripts/deploy-status.sh 15       # last N runs
# ===========================================

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "Not inside a git repository." >&2
    exit 1
fi
cd "$REPO_ROOT"

BLUE='\033[0;34m'
NC='\033[0m'

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found -- https://cli.github.com" >&2; exit 1; }

LIMIT="${1:-5}"

echo ""
echo -e "${BLUE}Last $LIMIT deploy-prod.yml runs:${NC}"
gh run list --workflow=deploy-prod.yml --limit="$LIMIT"

echo ""
echo "Full log of the most recent run:   gh run view --log"
echo "Only the failed steps:             gh run view --log-failed"
echo "Live server/container health:      ./scripts/status.sh"
echo ""
