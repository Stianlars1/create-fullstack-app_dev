#!/usr/bin/env bash
# CHAT_GPT_5_SOLUTION
# path: ..root/template/backend/deploy.sh

set -euo pipefail
docker compose pull || true
docker compose build
docker compose up -d
docker system prune -f
echo "Compose up complete."
