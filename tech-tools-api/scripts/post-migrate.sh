#!/bin/bash

# Post-migration hook: Auto-generate TypeScript types after migrations

set -e

echo ""
echo "🔄 Running post-migration tasks..."
echo ""

# Generate TypeScript types from updated database schema
echo "📝 Generating TypeScript types from database..."
npm run generate:types

echo ""
echo "✅ Post-migration tasks completed!"
echo ""
