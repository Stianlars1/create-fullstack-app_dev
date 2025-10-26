#!/usr/bin/env bash
# Deploy script - run on server after git pull
# Usage: ./scripts/deploy.sh

set -euo pipefail

echo "🚀 Deploying application..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  echo "Copy .env.example to .env and configure it first."
  exit 1
fi

# Pull latest images (if using registry)
echo "📦 Pulling latest images..."
docker compose pull || true

# Build containers
echo "🔨 Building containers..."
docker compose build

# Start services
echo "▶️  Starting services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check status
echo "📊 Service status:"
docker compose ps

# Clean up
echo "🧹 Cleaning up..."
docker system prune -f

echo "✅ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # View logs"
echo "  docker compose ps               # Check status"
echo "  docker compose restart backend  # Restart service"
