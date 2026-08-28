#!/bin/bash
# ===========================================
# Ship to production
# ===========================================
# The one command for "I changed something, get it live":
# local typecheck -> commit -> push -> watch the real CI/CD pipeline
# (.github/workflows/deploy-prod.yml) build + deploy, and report the result.
#
# Usage:
#   ./scripts/ship.sh "commit message"
#   ./scripts/ship.sh -y "commit message"     # no confirmation prompts
#   ./scripts/ship.sh --skip-checks "message" # skip local typecheck (e.g. docs-only)
#   ./scripts/ship.sh --no-watch "message"    # push and exit, don't wait for CI
#   ./scripts/ship.sh --dry-run                # show what would happen, change nothing
#
# Nothing here builds anything itself -- that's GitHub Actions' job. This
# script only does what you'd otherwise type by hand every time: check,
# commit, push, then watch the run instead of tabbing over to github.com.
# ===========================================

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "Not inside a git repository." >&2
    exit 1
fi
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[ship]${NC} $1"; }
log_success() { echo -e "${GREEN}[ship]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[ship]${NC} $1"; }
log_error() { echo -e "${RED}[ship]${NC} $1"; }

# ---- Parse args ----
ASSUME_YES=false
SKIP_CHECKS=false
NO_WATCH=false
DRY_RUN=false
COMMIT_MSG=""

for arg in "$@"; do
    case "$arg" in
        -y|--yes) ASSUME_YES=true ;;
        --skip-checks) SKIP_CHECKS=true ;;
        --no-watch) NO_WATCH=true ;;
        --dry-run) DRY_RUN=true ;;
        *) COMMIT_MSG="$arg" ;;
    esac
done

confirm() {
    if [ "$ASSUME_YES" = true ]; then return 0; fi
    read -r -p "$1 [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]]
}

# ---- Preflight ----
command -v gh >/dev/null 2>&1 || { log_error "gh CLI not found -- https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { log_error "gh CLI not authenticated -- run 'gh auth login'"; exit 1; }

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warn "You're on '$CURRENT_BRANCH', not 'main' -- deploy-prod.yml only triggers on pushes to main."
    confirm "Continue anyway?" || exit 1
fi

git fetch origin main --quiet

if [ "$DRY_RUN" = true ]; then
    echo ""
    log_warn "--dry-run: showing what would happen, changing nothing."
    echo ""
    if [ -n "$(git status --porcelain)" ]; then
        echo "Would commit:"
        git status -s
    else
        echo "Nothing uncommitted."
    fi
    AHEAD="$(git rev-list --count origin/main..HEAD)"
    echo ""
    echo "Commits ahead of origin/main: $AHEAD"
    CHANGED_FILES="$(git diff --name-only origin/main..HEAD; git diff --name-only)"
    echo ""
    echo "Workspaces that would be typechecked:"
    for ws in tech-tools-api admin-dashboard e-commerce-web-store; do
        echo "$CHANGED_FILES" | grep -q "^${ws}/" && echo "  - $ws"
    done
    exit 0
fi

# ---- Stage + commit (if there's anything to commit) ----
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    git status -s
    echo ""
    if [ -z "$COMMIT_MSG" ]; then
        # A single-line `read` only ever captures the FIRST line of a
        # pasted multi-line message -- the rest used to spill into the
        # shell and get executed as commands (confirmed live: pasting a
        # bulleted commit message produced a string of "command not
        # found" errors). Reads lines until a blank one instead, so a
        # multi-line paste is captured whole; press Enter once more after
        # pasting to finish.
        echo "Commit message (multi-line OK -- finish with an empty line):"
        while IFS= read -r line; do
            [ -z "$line" ] && break
            if [ -z "$COMMIT_MSG" ]; then
                COMMIT_MSG="$line"
            else
                COMMIT_MSG="$COMMIT_MSG
$line"
            fi
        done
        [ -n "$COMMIT_MSG" ] || { log_error "A commit message is required."; exit 1; }
    fi
    echo ""
    echo "Commit message:"
    echo "$COMMIT_MSG"
    confirm "Commit and push the changes above?" || exit 1
    git add -A
    git commit -m "$COMMIT_MSG"
else
    log_info "Nothing uncommitted -- checking for commits already ahead of origin/main."
fi

AHEAD="$(git rev-list --count origin/main..HEAD)"
if [ "$AHEAD" -eq 0 ]; then
    log_warn "Nothing to push -- HEAD already matches origin/main."
    exit 0
fi

# ---- Local checks, scoped to whichever workspace(s) actually changed ----
CHANGED_FILES="$(git diff --name-only origin/main..HEAD)"

check_workspace() {
    local dir="$1"
    local label="$2"
    if echo "$CHANGED_FILES" | grep -q "^${dir}/"; then
        log_info "Typechecking $label..."
        (cd "$dir" && npx tsc --noEmit) || {
            log_error "$label failed typecheck -- fix it before shipping (or rerun with --skip-checks to push anyway)."
            exit 1
        }
    fi
}

if [ "$SKIP_CHECKS" = true ]; then
    log_warn "Skipping local checks (--skip-checks)."
else
    check_workspace "tech-tools-api" "tech-tools-api"
    check_workspace "admin-dashboard" "admin-dashboard"
    check_workspace "e-commerce-web-store" "e-commerce-web-store"
    log_success "Local checks passed."
fi

# ---- Push ----
log_info "Pushing to origin/main ($AHEAD commit(s))..."
git push origin main

if [ "$NO_WATCH" = true ]; then
    log_success "Pushed. Not watching (--no-watch) -- check: gh run list --workflow=deploy-prod.yml"
    exit 0
fi

# ---- Find and watch the run this push just triggered ----
log_info "Waiting for GitHub Actions to pick up the push..."
RUN_ID=""
for _ in $(seq 1 15); do
    RUN_ID="$(gh run list --workflow=deploy-prod.yml --branch=main --limit=1 --json databaseId,headSha --jq \
        ".[] | select(.headSha == \"$(git rev-parse HEAD)\") | .databaseId" 2>/dev/null)"
    [ -n "$RUN_ID" ] && break
    sleep 2
done

if [ -z "$RUN_ID" ]; then
    log_warn "Couldn't find the triggered run yet -- check manually: gh run list --workflow=deploy-prod.yml"
    exit 0
fi

log_info "Watching run $RUN_ID (this builds in CI, then deploys over Tailscale SSH)..."
if gh run watch "$RUN_ID" --exit-status; then
    echo ""
    log_success "Deployed."
    echo "  Store: https://techtoolstore.com"
    echo "  Admin: https://techtoolstore.com/admin/"
    echo "  API:   https://techtoolstore.com/api/v1/health"
else
    echo ""
    log_error "The deploy run failed -- $(gh run view "$RUN_ID" --json url --jq .url)"
    log_error "See what broke: gh run view $RUN_ID --log-failed"
    exit 1
fi
