#!/usr/bin/env bash
# Bootstrap script for new server setup
# Run once: sudo ./scripts/bootstrap-server.sh

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "❌ Run as root: sudo ./scripts/bootstrap-server.sh"
  exit 1
fi

echo "🚀 Bootstrapping server..."

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  usermod -aG docker ubuntu
else
  echo "✓ Docker already installed"
fi

# Install Docker Compose
if ! docker compose version >/dev/null 2>&1; then
  echo "🐳 Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin
else
  echo "✓ Docker Compose already installed"
fi

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 443/udp  # HTTP/3
ufw --force enable

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /srv/apps
chown -R ubuntu:ubuntu /srv/apps

# Set up automatic security updates
echo "🔐 Enabling automatic security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Copy your project files to /srv/apps/your-app-name"
echo "2. Run: cd /srv/apps/your-app-name && ./scripts/deploy.sh"
