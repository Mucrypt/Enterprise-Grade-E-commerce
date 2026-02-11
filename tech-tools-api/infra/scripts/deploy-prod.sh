#!/bin/bash

# TechTools API - Production Deployment Script
# Run this on your Hetzner server

set -e

echo "🚀 Deploying TechTools API to Production..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create .env.production with your production settings."
    exit 1
fi

# Load production environment
export $(cat .env.production | xargs)

# Update Nginx configuration with actual domain
echo "🔧 Updating Nginx configuration with domain: $DOMAIN"
sed -i "s/your-domain.com/$DOMAIN/g" infra/nginx/production/default.conf

# Navigate to docker directory
cd infra/docker/production

# Pull latest images
echo "📦 Pulling latest Docker images..."
docker-compose pull

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 15

# Check health
echo "🔍 Checking service health..."
docker-compose ps

echo ""
echo "✅ Production deployment completed!"
echo ""
echo "🌐 Your API should be available at: https://$DOMAIN"
echo ""
echo "🔐 Next steps:"
echo "   1. Obtain SSL certificate: ./infra/scripts/ssl-setup.sh"
echo "   2. Check logs: cd infra/docker/production && docker-compose logs -f"
echo ""
