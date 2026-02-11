#!/bin/bash

# Auto Type Generator - Watches database schema and auto-generates TypeScript types
# This script runs the type generator whenever migration files change

set -e

echo "🔍 Watching database migrations for changes..."
echo "📝 Types will be auto-generated when migrations are updated"
echo ""
echo "Press Ctrl+C to stop watching"
echo ""

# Run initial generation
npm run generate:types

# Watch for changes
nodemon --watch src/database/migrations/*.sql --exec npm run generate:types
