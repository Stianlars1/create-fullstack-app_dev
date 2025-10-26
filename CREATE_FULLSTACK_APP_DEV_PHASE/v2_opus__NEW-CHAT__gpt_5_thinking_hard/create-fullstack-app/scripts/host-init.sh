#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:?Usage: sudo ./scripts/host-init.sh <domain>}"

apt-get update
apt-get -y upgrade
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
apt-get -y install docker-compose-plugin ufw wget
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable

docker compose pull || true
docker compose build || true
docker compose up -d

echo "App is expected at https://${DOMAIN}"
