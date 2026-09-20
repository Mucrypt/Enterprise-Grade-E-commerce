#!/bin/bash
# ===========================================
# Generate Types from Production Database
# ===========================================
# Run locally: ./server-scripts/generate-types-prod.sh
# Generates TypeScript types from production DB
# ===========================================

set -e

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Generate Types from Production DB"
echo "=========================================="
echo ""

# Load production env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -E '^DB_' | xargs)
fi

log_info "Connecting to production database..."
log_info "  Host: ${DB_HOST:-postgres}"
log_info "  Database: ${DB_NAME:-techtools}"

# The production image only ships compiled JS + non-dev dependencies
# (ts-node/typescript are devDependencies, correctly excluded from that
# image) -- generate:types:local's `ts-node ...` doesn't exist in this
# container. generate:types:prod runs the already-compiled
# dist/scripts/generate-types-from-db.js with plain `node` instead; the
# API's own Dockerfile build already produces this as part of its normal
# `npm run build` step, no extra install needed here.
docker exec techtools-api-prod sh -c "cd /app && npm run generate:types:prod"

if [ $? -eq 0 ]; then
    log_success "Types generated successfully!"

    # /app itself is root-owned in this container (only uploads/,
    # private-uploads/, and dist/ are chowned to the non-root user it
    # runs as), so the script can't create /app/src/types there and
    # falls back to the always-writable /app/dist/types/generated.ts
    # instead (see generate-types-from-db.ts). Try the "real" path
    # first so this script still works unchanged against a container
    # that CAN write it (a future image that does chown /app, or a
    # differently-built one), and only fall back if that file isn't
    # actually there.
    log_info "Copying generated types to local..."
    CONTAINER_TYPES_PATH="/app/src/types/generated.ts"
    if ! docker exec techtools-api-prod test -f "$CONTAINER_TYPES_PATH"; then
        CONTAINER_TYPES_PATH="/app/dist/types/generated.ts"
        log_info "  (using fallback path inside the container: $CONTAINER_TYPES_PATH)"
    fi
    # This checkout may be a sparse one (the production server's is --
    # e.g. it may never have needed tech-tools-mobile-app/ at all, since
    # nothing here builds or deploys the mobile app). Only copy into a
    # sibling that actually exists locally rather than hard-failing
    # (`set -e`) on one that was never checked out.
    docker cp "techtools-api-prod:$CONTAINER_TYPES_PATH" tech-tools-api/src/types/generated.ts

    log_success "Types copied to:"
    echo "  - tech-tools-api/src/types/generated.ts"
    for target in \
        "admin-dashboard/types/generated.ts" \
        "e-commerce-web-store/src/types/generated.ts" \
        "tech-tools-mobile-app/src/types/generated.ts"; do
        target_dir="$(dirname "$target")"
        if [ -d "$target_dir" ]; then
            docker cp "techtools-api-prod:$CONTAINER_TYPES_PATH" "$target"
            echo "  - $target"
        else
            echo "  - $target (skipped -- $target_dir not present in this checkout)"
        fi
    done
else
    echo "Failed to generate types"
    exit 1
fi
