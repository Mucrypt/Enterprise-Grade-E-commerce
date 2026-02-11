#!/bin/bash

# TechTools API - Development Environment Setup
# Run this script to start the development environment

set -e

echo "🚀 Starting TechTools API Development Environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your settings."
fi

# Navigate to docker directory
cd infra/docker/development

# Build and start containers
echo "📦 Building and starting Docker containers..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "📚 Services are available at:"
echo "   - API: http://localhost:9000"
echo "   - Nginx: http://localhost:80"
echo "   - PgAdmin: http://localhost:8080"
echo "   - Redis Commander: http://localhost:8081"
echo ""
echo "📖 Useful commands:"
echo "   - View logs: cd infra/docker/development && docker-compose logs -f"
echo "   - Stop: ./infra/scripts/dev-down.sh"
echo "   - Restart: ./infra/scripts/dev-restart.sh"
echo ""
