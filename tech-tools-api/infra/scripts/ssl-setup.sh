#!/bin/bash

# SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificates for your domain

set -e

# Check if domain is set
if [ -z "$DOMAIN" ]; then
    read -p "Enter your domain name (e.g., api.techtools.com): " DOMAIN
fi

read -p "Enter your email address: " EMAIL

echo "🔐 Setting up SSL certificate for $DOMAIN..."

# Navigate to production docker directory
cd infra/docker/production

# Obtain certificate
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Reload nginx
docker-compose exec nginx nginx -s reload

echo "✅ SSL certificate obtained and installed!"
echo "🔒 Your API is now secured with HTTPS"
echo ""
echo "Certificate will auto-renew every 12 hours."
