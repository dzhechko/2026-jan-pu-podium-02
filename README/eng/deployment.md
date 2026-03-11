# ReviewHub Deployment Guide

## Requirements

### Server (VPS)
- **OS:** Ubuntu 22.04 LTS
- **CPU:** 4 vCPU
- **RAM:** 8 GB
- **Disk:** 100 GB SSD
- **Location:** Moscow, Russia (152-FZ compliance)
- **Provider:** AdminVPS or HOSTKEY
- **Cost:** ~$30-50/month

### Software
- Docker 24+
- Docker Compose v2
- Git
- OpenSSL (for self-signed certificates)

## Production Stack Architecture

Production uses `docker-compose.prod.yml` with a separate Nginx config (`nginx/prod.conf`).

```
Client
  |
  +-- :443  -> Nginx -> Admin Panel (static) + API (/api/)
  +-- :9443 -> Nginx -> PWA (static) + API (/api/)
                |
                +-- PostgreSQL 16 (Docker volume)
                +-- Redis 7 (Docker volume)
```

- **Admin panel + API:** port 443 (HTTPS)
- **PWA (review form):** port 9443 (HTTPS)
- **SSL:** self-signed certificate for IP `89.125.130.105`

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install OpenSSL (usually pre-installed)
sudo apt install openssl
```

### 2. Clone Repository

```bash
cd /opt
git clone <repo-url> reviewhub
cd reviewhub
```

### 3. Generate Self-Signed SSL Certificate

For IP-based deployment (no domain), a self-signed certificate is used.

```bash
mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout nginx/ssl/selfsigned.key \
  -out nginx/ssl/selfsigned.crt \
  -subj "/CN=89.125.130.105" \
  -addext "subjectAltName=IP:89.125.130.105"
```

The certificate is also mounted into the API container (`/app/ssl/selfsigned.crt`) -- it is needed for Telegram webhook registration with a self-signed certificate.

### 4. Configure Environment

```bash
cp .env.example .env.production
nano .env.production
```

Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | Generate a strong password |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://reviewhub:PASSWORD@postgres:5432/reviewhub` |
| `JWT_SECRET` | Access token secret | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `openssl rand -hex 32` |
| `SMSC_LOGIN` | SMSC.ru login | Your login |
| `SMSC_PASSWORD` | SMSC.ru password | Your password |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |
| `ENCRYPTION_KEY` | Phone encryption key | `openssl rand -hex 32` |
| `WEBHOOK_SECRET` | Webhook secret (min 32 chars) | `openssl rand -hex 32` |
| `APP_URL` | Admin panel URL | `https://89.125.130.105` |
| `PWA_URL` | Review form URL | `https://89.125.130.105:9443` |
| `API_BASE_URL` | Public API URL | `https://89.125.130.105` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | `123456:ABC-DEF...` |
| `MAX_BOT_TOKEN` | Max bot token (optional) | Token from Max |

### 5. Build and Start (Production)

```bash
# Build and start with production config
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Verify health
curl -k https://localhost/api/health
```

The `-k` flag is needed for curl when working with self-signed certificates.

### 6. Verification

```bash
# API
curl -k https://89.125.130.105/api/health

# Admin panel
curl -kI https://89.125.130.105

# PWA
curl -kI https://89.125.130.105:9443
```

On first visit in a browser, you will see a self-signed certificate warning -- click "Advanced" -> "Proceed to site".

## Docker Compose: dev vs prod

### Development (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `api` | node:20-alpine | 3000 | Backend API |
| `admin` | nginx:alpine | -- | Admin panel (static) |
| `pwa` | nginx:alpine | -- | PWA review form (static) |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy + SSL (Let's Encrypt) |
| `certbot` | certbot/certbot | -- | Auto-renew certificates |
| `postgres` | postgres:16 | 5432 | Database |
| `redis` | redis:7 | 6379 | Cache |

### Production (`docker-compose.prod.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `api` | node:20-alpine | -- | Backend API (internal) |
| `admin` | nginx:alpine | -- | Admin panel (static) |
| `pwa` | nginx:alpine | -- | PWA review form (static) |
| `nginx` | nginx:alpine | 80, 443, 9443 | Reverse proxy + SSL (self-signed) |
| `postgres` | postgres:16 | -- | Database (Docker volume) |
| `redis` | redis:7 | -- | Cache (Docker volume) |

Key production differences:
- No `certbot` -- uses self-signed certificate
- API port not exposed externally (access only via Nginx)
- PostgreSQL and Redis ports not exposed (security)
- Separate port 9443 for PWA
- Dedicated Docker network `reviewhub`
- SSL certificate mounted into API container for Telegram webhook

## Monorepo Docker Build: Known Issues

### Non-hoisted dependencies

In a monorepo, npm doesn't always hoist dependencies to the root. The Dockerfile handles this by copying node_modules from both levels:

```dockerfile
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/api/node_modules ./node_modules
```

The second COPY overwrites root-level packages with package-specific versions.

### Prisma + OpenSSL

Prisma requires OpenSSL for client generation in Alpine containers:

```dockerfile
FROM base AS api
RUN apk add --no-cache openssl
```

Without this, `prisma generate` and DB queries fail with a `libssl` error.

## Telegram Webhook with Self-Signed Certificate

When using a self-signed certificate, the Telegram API requires the certificate to be uploaded during webhook registration. The system does this automatically when you save the bot token in settings.

The certificate is mounted into the API container for this purpose:

```yaml
# docker-compose.prod.yml
api:
  volumes:
    - ./nginx/ssl/selfsigned.crt:/app/ssl/selfsigned.crt:ro
```

The API sends the certificate when calling `setWebhook`:

```
POST https://api.telegram.org/bot{token}/setWebhook
  - url: https://89.125.130.105/api/webhooks/telegram
  - certificate: @/app/ssl/selfsigned.crt
```

Without uploading the certificate, Telegram will refuse to deliver updates to an HTTPS endpoint with a self-signed certificate.

## Backups

### Automated PostgreSQL Backup

```bash
#!/bin/bash
# /opt/reviewhub/backup.sh -- run via cron daily at 03:00 MSK
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U reviewhub reviewhub | gzip > $BACKUP_DIR/reviewhub_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
echo "Backup complete: reviewhub_$DATE.sql.gz"
```

```cron
0 3 * * * /opt/reviewhub/backup.sh
```

### Restore from Backup

```bash
# 1. Stop the API (to prevent active connections)
docker compose -f docker-compose.prod.yml stop api

# 2. Restore the dump
gunzip -c /backups/postgres/reviewhub_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reviewhub -d reviewhub

# 3. Start the API
docker compose -f docker-compose.prod.yml start api

# 4. Verify
curl -k https://localhost/api/health
```

For restoring to a clean database (e.g., server migration):

```bash
# Create database
docker compose -f docker-compose.prod.yml exec postgres \
  createdb -U reviewhub reviewhub_new

# Restore
gunzip -c backup.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reviewhub -d reviewhub_new
```

## Rollback

```bash
docker compose -f docker-compose.prod.yml down
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up -d --build
# Restore DB from backup if needed (see above)
```

## Updates

```bash
cd /opt/reviewhub

# 1. Create backup before updating
./backup.sh

# 2. Pull updates
git pull origin main

# 3. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# 4. Apply migrations (if any)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 5. Verify
curl -k https://localhost/api/health
```

## CI/CD

Push to `main` triggers GitHub Actions: tests -> SSH deploy to VPS.

Configuration: `.github/workflows/deploy.yml`. Secrets: `VPS_HOST`, `VPS_USER`, `VPS_KEY`.

## Migrating to Domain + Let's Encrypt

When a domain becomes available, switch to `docker-compose.yml` (with certbot):

1. Configure DNS A records pointing to the server IP
2. Update `APP_URL`, `PWA_URL`, `API_BASE_URL` in `.env.production`
3. Switch to the main `docker-compose.yml`
4. Obtain certificate: `sudo certbot --nginx -d admin.reviewhub.ru -d review.reviewhub.ru`
5. Update Telegram bot token (webhook will be re-registered automatically)
