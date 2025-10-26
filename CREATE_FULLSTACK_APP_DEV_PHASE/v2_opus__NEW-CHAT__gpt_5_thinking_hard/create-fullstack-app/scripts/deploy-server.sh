#!/usr/bin/env bash
set -euo pipefail
git pull origin main || true
docker compose pull || true
docker compose build || true
docker compose up -d
docker system prune -f || true
