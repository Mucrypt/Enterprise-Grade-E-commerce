#!/bin/bash

# TechTools API - Restart Development Environment

set -e

echo "🔄 Restarting TechTools API Development Environment..."

cd infra/docker/development
docker-compose restart

echo "✅ Development environment restarted!"
