#!/bin/bash
set -e

# This script initializes the database
echo "🚀 Initializing TechTools database..."

# Run migrations from the migrations directory
for file in /migrations/*.sql; do
    if [ -f "$file" ]; then
        echo "Running migration: $(basename $file)"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$file"
    fi
done

echo "✅ Database initialization completed!"
