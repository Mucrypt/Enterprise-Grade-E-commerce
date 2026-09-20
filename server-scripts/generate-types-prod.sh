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
    
    # Copy from container to local
    log_info "Copying generated types to local..."
    docker cp techtools-api-prod:/app/src/types/generated.ts tech-tools-api/src/types/generated.ts
    docker cp techtools-api-prod:/app/src/types/generated.ts admin-dashboard/types/generated.ts
    
    log_success "Types copied to:"
    echo "  - tech-tools-api/src/types/generated.ts"
    echo "  - admin-dashboard/types/generated.ts"
else
    echo "Failed to generate types"
    exit 1
fi
