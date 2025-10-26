#!/usr/bin/env bash
# CHAT_GPT_5_SOLUTION
# path: ..root/scripts/deploy-from-mac.sh

set -euo pipefail
SERVER="${SERVER:-ubuntu@YOUR_SERVER_IP}"
APP_NAME="${APP_NAME:-my-app}"
APP_DIR="${APP_DIR:-/srv/apps/${APP_NAME}}"

ssh "${SERVER}" "mkdir -p ${APP_DIR}"
rsync -az --delete ./ "${SERVER}:${APP_DIR}/"
ssh "${SERVER}" "cd ${APP_DIR} && docker compose pull || true && docker compose build && docker compose up -d && docker system prune -f"
echo "Deployed ${APP_NAME} on ${SERVER}."
