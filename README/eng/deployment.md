# ReviewHub Deployment Guide

## Requirements

### Server (VPS)
- **OS:** Ubuntu 22.04 LTS
- **CPU:** 4 vCPU
- **RAM:** 8 GB
- **Disk:** 100 GB SSD
- **Location:** Moscow, Russia (152-FZ compliance)
- **Provider:** AdminVPS or HOSTKEY
- **Cost:** ~$30–50/month

### Software
- Docker 24+
- Docker Compose v2
- Git
- Certbot (for SSL)

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install certbot
sudo apt install certbot python3-certbot-nginx
```

### 2. Clone Repository

```bash
cd /opt
git clone <repo-url> reviewhub
cd reviewhub
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://reviewhub:PASSWORD@postgres:5432/reviewhub` |
| `JWT_SECRET` | Access token secret | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `openssl rand -hex 32` |
| `SMSC_LOGIN` | SMSC.ru login | Your login |
| `SMSC_PASSWORD` | SMSC.ru password | Your password |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |
| `ENCRYPTION_KEY` | Phone encryption key | `openssl rand -hex 32` |
| `WEBHOOK_SECRET` | Webhook secret (min 32 chars) | `openssl rand -hex 32` |
| `APP_URL` | Admin panel URL | `https://admin.reviewhub.ru` |
| `PWA_URL` | Review form URL | `https://review.reviewhub.ru` |
| `API_BASE_URL` | Public API URL | `https://admin.reviewhub.ru` |

### 4. Start Services

```bash
# Build and start
docker compose up -d

# Run database migrations
docker compose exec api npx prisma migrate deploy

# Verify health
curl http://localhost:3000/api/health
```

### 5. DNS Configuration

Create A records:

| Domain | Type | Value |
|--------|------|-------|
| `admin.reviewhub.ru` | A | Server IP |
| `review.reviewhub.ru` | A | Server IP |

### 6. SSL Setup

```bash
sudo certbot --nginx -d admin.reviewhub.ru -d review.reviewhub.ru
```

### 7. Verification

```bash
# API
curl https://admin.reviewhub.ru/api/health

# Admin panel
curl -I https://admin.reviewhub.ru

# PWA
curl -I https://review.reviewhub.ru
```

## Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `api` | node:20-alpine | 3000 | Backend API |
| `admin` | nginx:alpine | — | Admin panel (static) |
| `pwa` | nginx:alpine | — | PWA review form (static) |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy + SSL |
| `postgres` | postgres:16 | 5432 | Database |
| `redis` | redis:7 | 6379 | Cache |

## Rollback

```bash
docker compose down
git checkout <previous-tag>
docker compose up -d
# Restore DB from backup if needed
```

## Backups

Automated PostgreSQL backup:

```bash
#!/bin/bash
# /opt/reviewhub/backup.sh — run via cron daily at 03:00 MSK
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U reviewhub reviewhub | gzip > $BACKUP_DIR/reviewhub_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
```

```cron
0 3 * * * /opt/reviewhub/backup.sh
```

## CI/CD

Push to `main` triggers GitHub Actions: tests -> SSH deploy to VPS.

Configuration: `.github/workflows/deploy.yml`. Secrets: `VPS_HOST`, `VPS_USER`, `VPS_KEY`.
