# Completion: ReviewHub

## Deployment Plan

### Pre-Deployment Checklist
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scan (npm audit, no critical vulnerabilities)
- [ ] Environment variables configured on VPS
- [ ] PostgreSQL and Redis provisioned
- [ ] SSL certificates (Let's Encrypt)
- [ ] SMSC.ru account verified, balance loaded
- [ ] LLM API key configured
- [ ] Nginx config reviewed
- [ ] Docker images built and tested locally
- [ ] Backup script configured

### Deployment Sequence

1. Provision VPS (Ubuntu 22.04, Moscow DC)
2. Install Docker + Docker Compose
3. Clone repository
4. Copy `.env` with production values
5. `docker compose up -d`
6. Run Prisma migrations: `docker compose exec api npx prisma migrate deploy`
7. Verify health checks
8. Configure DNS (A records for admin, review subdomains)
9. Setup SSL with certbot
10. Smoke test all endpoints

### Rollback Procedure

1. `docker compose down`
2. `git checkout <previous-tag>`
3. `docker compose up -d`
4. If DB migration needed: restore from backup
5. Verify rollback successful

---

## CI/CD Configuration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: reviewhub_test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_KEY }}
          script: |
            cd /opt/reviewhub
            git pull origin main
            docker compose build
            docker compose up -d
            docker compose exec -T api npx prisma migrate deploy
```

---

## Monitoring & Alerting

### Health Check Endpoint

```
GET /api/health
Response 200: {
  status: "ok",
  uptime: 123456,
  db: "connected",
  redis: "connected",
  smsc_balance: 1500.00
}
```

### Key Metrics

| Metric | Threshold | Alert Channel |
|--------|-----------|---------------|
| API response p99 | > 1s | Telegram bot |
| Error rate (5xx) | > 1% | Telegram bot |
| SMS delivery rate | < 85% | Email |
| SMSC balance | < ₽1000 | Telegram + Email |
| Disk usage | > 85% | Telegram |
| DB connections | > 80% pool | Telegram |
| Cron job missed | > 15 min gap | Telegram |

### Logging Strategy

- **Format:** JSON structured logs
- **Levels:** ERROR, WARN, INFO, DEBUG
- **Rotation:** Daily, retain 30 days
- **Fields:** timestamp, level, module, message, request_id, user_id
- **Storage:** Docker logs → file mount → /var/log/reviewhub/
- **Sensitive data:** Never log phone numbers, passwords, tokens

---

## Backup Strategy

### Database
- **Automated:** pg_dump daily at 03:00 MSK
- **Retention:** 30 daily + 12 weekly
- **Storage:** Local + offsite (S3-compatible RU storage)
- **Test restore:** Monthly

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U reviewhub reviewhub | gzip > $BACKUP_DIR/reviewhub_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://reviewhub:PASSWORD@postgres:5432/reviewhub

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=<random-64-chars>
JWT_REFRESH_SECRET=<random-64-chars>

# SMSC.ru
SMSC_LOGIN=your_login
SMSC_PASSWORD=your_password
SMSC_SENDER=ReviewHub

# LLM
ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY=sk-...

# Encryption
ENCRYPTION_KEY=<random-32-bytes-hex>

# App
APP_URL=https://admin.reviewhub.ru
PWA_URL=https://review.reviewhub.ru
NODE_ENV=production
PORT=3000
```

---

## Handoff Checklists

### For Development
- [ ] Repository access (GitHub)
- [ ] `.env.example` documented
- [ ] `npm install && npm run dev` works
- [ ] Docker Compose local setup documented
- [ ] API docs (Swagger) available at /docs

### For Operations
- [ ] VPS access (SSH keys)
- [ ] Monitoring dashboard setup
- [ ] Backup verification procedure
- [ ] SMSC.ru account credentials
- [ ] SSL certificate auto-renewal (certbot)
- [ ] Escalation contacts
