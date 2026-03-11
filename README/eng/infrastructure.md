# Infrastructure Requirements

## Minimum Requirements (MVP)

| Parameter | Value |
|-----------|-------|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Disk | 100 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Location | Moscow, Russia |
| Cost | ~$30–50/month |

## Recommended Providers

| Provider | Why | Notes |
|----------|-----|-------|
| AdminVPS | Moscow DC, 152-FZ compliant | Recommended for MVP |
| HOSTKEY | Moscow DC, reliable | Alternative |

## Docker Services

```
┌────────────────────────────────────────────────────┐
│                   NGINX (ports 80, 443)            │
│              SSL + Reverse Proxy + Static          │
├──────────┬──────────┬──────────────────────────────┤
│  Admin   │   PWA    │          API                 │
│  (static)│  (static)│    (Node.js, port 3000)      │
├──────────┴──────────┴──────────┬───────────────────┤
│                                │                   │
│         PostgreSQL 16          │     Redis 7       │
│         (port 5432)            │   (port 6379)     │
│         1 GB RAM               │    128 MB RAM     │
└────────────────────────────────┴───────────────────┘
```

### Resource Allocation

| Service | RAM | CPU | Disk |
|---------|-----|-----|------|
| API (Node.js) | 512 MB | 1 vCPU | — |
| PostgreSQL | 1 GB | 1 vCPU | ~50 GB |
| Redis | 128 MB | 0.5 vCPU | — |
| Nginx | 64 MB | 0.5 vCPU | — |
| Admin (static) | 64 MB | — | ~10 MB |
| PWA (static) | 64 MB | — | ~5 MB |
| OS + Docker | 2 GB | 1 vCPU | ~10 GB |
| **Total** | **~4 GB** | **4 vCPU** | **~65 GB** |

## Network Requirements

### Outbound Connections

| Service | URL | Port | Purpose |
|---------|-----|------|---------|
| SMSC.ru | `smsc.ru/sys/send.php` | 443 | SMS delivery |
| Anthropic | `api.anthropic.com` | 443 | Sentiment analysis |
| GitHub | `github.com` | 443 | CI/CD deployment |

### Inbound Ports

| Port | Service | Purpose |
|------|---------|---------|
| 80 | Nginx | HTTP → HTTPS redirect |
| 443 | Nginx | HTTPS (admin + PWA) |
| 22 | SSH | Server administration |

## SSL Certificates

- **Provider:** Let's Encrypt (free)
- **Renewal:** Automatic via certbot
- **Domains:** `admin.reviewhub.ru`, `review.reviewhub.ru`

## Scaling

| Stage | Users | Infrastructure |
|-------|-------|----------------|
| MVP | 100 admins | 1 VPS (4 vCPU, 8 GB) |
| Year 1 | 1,000 admins | 1 VPS (8 vCPU, 16 GB) |
| Year 3 | 10,000 admins | Multiple VPS + load balancer |

## Monitoring

### Health Check

```
GET /api/health → 200
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "smsc_balance": 1500.00
}
```

### Alerts

| Metric | Threshold | Channel |
|--------|-----------|---------|
| API p99 latency | > 1s | Telegram |
| 5xx error rate | > 1% | Telegram |
| SMS delivery rate | < 85% | Email |
| SMSC balance | < 1,000 RUB | Telegram + Email |
| Disk usage | > 85% | Telegram |

## Backups

- PostgreSQL: `pg_dump` daily at 03:00 MSK
- Retention: 30 daily + 12 weekly
- Restore test: monthly
