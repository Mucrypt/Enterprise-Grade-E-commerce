#!/bin/bash

# TechTools API - Stop Development Environment

set -e

echo "🛑 Stopping TechTools API Development Environment..."

cd infra/docker/development
docker-compose down

echo "✅ Development environment stopped!"
