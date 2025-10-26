#!/usr/bin/env bash
# CHAT_GPT_5_SOLUTION
# path: ..root/scripts/bootstrap-server.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root: sudo ./scripts/bootstrap-server.sh"
  exit 1
fi

apt-get update
apt-get upgrade -y

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

apt-get install -y docker-compose-plugin ufw

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /srv/apps
chown -R ubuntu:ubuntu /srv/apps

echo "Bootstrap complete."
