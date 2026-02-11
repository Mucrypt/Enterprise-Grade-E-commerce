#!/bin/bash

# Sync generated types from API to Admin Dashboard
# Run this after generating types from the database

set -e

API_TYPES="../tech-tools-api/src/types/generated.ts"
DASHBOARD_TYPES="./types/generated.ts"

if [ ! -f "$API_TYPES" ]; then
  echo "❌ Error: Generated types not found at $API_TYPES"
  echo "Run 'npm run generate:types' in tech-tools-api first"
  exit 1
fi

echo "📋 Copying types from API to Admin Dashboard..."
cp "$API_TYPES" "$DASHBOARD_TYPES"

echo "✅ Types synchronized successfully!"
echo "   Source: $API_TYPES"
echo "   Target: $DASHBOARD_TYPES"
