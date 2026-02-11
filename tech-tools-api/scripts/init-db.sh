#!/bin/bash

# Database initialization script
# Run this after the database container is up

echo "Initializing TechTools database..."

# Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432 -U techtools_user; do
  echo "Waiting for database to be ready..."
  sleep 2
done

# Run SQL files if any exist
if [ -d "./init-scripts" ]; then
  for sql_file in ./init-scripts/*.sql; do
    if [ -f "$sql_file" ]; then
      echo "Running $sql_file..."
      psql -h localhost -p 5432 -U techtools_user -d techtools -f "$sql_file"
    fi
  done
fi

echo "Database initialization complete!"