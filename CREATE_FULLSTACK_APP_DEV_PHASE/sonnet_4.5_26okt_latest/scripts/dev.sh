#!/usr/bin/env bash
# Start local development environment
# Usage: ./scripts/dev.sh

set -euo pipefail

echo "🚀 Starting local development environment..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env not found, copying from .env.example..."
  cp .env.example .env
  echo "✏️  Please edit .env with your configuration"
fi

# Start services
echo "▶️  Starting Docker containers..."
docker compose up -d

echo "✅ Development environment ready!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8080"
echo "🗄️  Database: localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "  docker compose logs -f          # View all logs"
echo "  docker compose logs -f frontend # View frontend logs"
echo "  docker compose logs -f backend  # View backend logs"
echo "  docker compose down             # Stop all services"
