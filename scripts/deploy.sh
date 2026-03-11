#!/bin/bash
set -euo pipefail

# ReviewHub Deploy Script
# Usage: ./scripts/deploy.sh [--init-ssl]

DOMAIN_ADMIN="admin.reviewhub.ru"
DOMAIN_PWA="review.reviewhub.ru"
EMAIL="admin@reviewhub.ru"

echo "=== ReviewHub Deploy ==="

# Check .env.production exists
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Copy from .env.production.example"
  exit 1
fi

# Initialize SSL certificates (first deploy only)
if [ "${1:-}" = "--init-ssl" ]; then
  echo "Initializing SSL certificates..."

  # Start nginx temporarily for ACME challenge
  docker compose up -d nginx

  # Get certificates
  docker compose run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$DOMAIN_ADMIN"

  docker compose run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$DOMAIN_PWA"

  echo "SSL certificates obtained."
fi

# Build and deploy
echo "Building images..."
docker compose build

echo "Running database migrations..."
docker compose run --rm api npx prisma migrate deploy

echo "Starting services..."
docker compose up -d

echo "Checking health..."
sleep 5
curl -sf http://localhost:3000/api/health || echo "WARNING: API health check failed"

echo ""
echo "=== Deploy Complete ==="
echo "Admin:  https://$DOMAIN_ADMIN"
echo "PWA:    https://$DOMAIN_PWA"
echo "API:    https://$DOMAIN_ADMIN/api/health"
