#!/usr/bin/env bash
# Deploy from local machine to server
# Usage: SERVER=ubuntu@123.45.67.89 ./scripts/deploy-from-mac.sh

set -euo pipefail

SERVER="${SERVER:-ubuntu@YOUR_SERVER_IP}"
APP_NAME=$(basename "$PWD")
APP_DIR="/srv/apps/${APP_NAME}"

echo "🚀 Deploying ${APP_NAME} to ${SERVER}..."

# Ensure server directory exists
echo "📁 Creating directory on server..."
ssh "${SERVER}" "mkdir -p ${APP_DIR}"

# Sync files (excluding node_modules, .git, etc.)
echo "📤 Syncing files..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'build' \
  --exclude '.gradle' \
  --exclude '.git' \
  --exclude '.env' \
  ./ "${SERVER}:${APP_DIR}/"

# Run deployment on server
echo "🔧 Running deployment on server..."
ssh "${SERVER}" "cd ${APP_DIR} && ./scripts/deploy.sh"

echo "✅ Deployment complete!"
