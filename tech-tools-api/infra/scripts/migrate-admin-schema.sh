#!/bin/bash

# Admin Management Schema Migration
# Run this to set up enterprise admin security

echo "🔐 Running Admin Management Schema Migration..."

# Run the migration
docker exec -i techtools-postgres-dev psql -U techtools_user -d techtools < "$(dirname "$0")/../../src/database/migrations/002_admin_management_schema.sql"

if [ $? -eq 0 ]; then
    echo "✅ Admin management schema created successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Create your first super admin:"
    echo "   npm run seed:superadmin"
    echo ""
    echo "2. Then restart the API:"
    echo "   docker-compose restart api"
    echo ""
else
    echo "❌ Migration failed!"
    exit 1
fi
