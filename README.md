# ReviewHub

Платформа автоматического сбора и маршрутизации отзывов для российского малого бизнеса. Аналог [Podium](https://www.podium.com/) для российского рынка.

## Что делает

1. **Мультиканальная рассылка** — SMS, Telegram, Max с автоматическим fallback на SMS
2. **PWA-форма** — клиент открывает ссылку, ставит оценку и пишет текст
3. **AI-анализ** — Claude API анализирует тональность отзыва
4. **Маршрутизация** — позитивные → redirect на Яндекс Карты, негативные → скрытый раздел + промокод
5. **Напоминания** — каскад из 4 сообщений (2ч → 24ч → 3д → 7д)
6. **Автоподключение мессенджеров** — клиент получает ссылку на бота в SMS, подписывается одним нажатием
7. **Аналитика по каналам** — статистика отправок, ошибок и конверсии по каждому каналу

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend (Admin) | React 18 + TypeScript + Vite + Shadcn/ui |
| Frontend (PWA) | React 18 + TypeScript + Vite |
| Backend | Node.js 20 + Fastify 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| SMS | SMSC.ru HTTP API |
| Messengers | Telegram Bot API, Max Bot API |
| AI | Anthropic Claude API (sentiment analysis) |
| Deploy | Docker Compose + Nginx + SSL on VPS (Russia, 152-ФЗ) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      CLIENTS                         │
│   Admin Panel (React)    PWA Review Form (React)     │
└─────────┬────────────────────────┬──────────────────┘
          │                        │
          ▼                        ▼
┌─────────────────────────────────────────────────────┐
│              API (Node.js + Fastify)                 │
│  Auth │ Clients │ Reviews │ SMS │ Analytics │ Webhooks│
│                                                      │
│  Message Gateway (SMS + Telegram + Max + Fallback)   │
└───┬──────────┬──────────┬───────────┬───────────────┘
    │          │          │           │
    ▼          ▼          ▼           ▼
 SMSC.ru   Telegram   Max Bot    Claude API
  (SMS)    Bot API      API      (Sentiment)

┌─────────────────────────────────────────────────────┐
│              PostgreSQL 16  +  Redis 7               │
└─────────────────────────────────────────────────────┘
```

## Production Deployment

ReviewHub runs on a VPS with Docker Compose, Nginx reverse proxy, and self-signed SSL.

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Push Prisma schema to database
docker compose -f docker-compose.prod.yml exec api npx prisma db push --skip-generate

# Restore database backup (if needed)
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reviewhub -d reviewhub < reviewhub_backup.sql
```

**Live endpoints:**
- Admin panel: `https://89.125.130.105` (port 443)
- PWA review form: `https://89.125.130.105:9443`
- API: `https://89.125.130.105/api/`

**Infrastructure:**
- Nginx reverse proxy with self-signed SSL (TLS 1.2/1.3)
- PostgreSQL 16 + Redis 7 in Docker
- API container: Node.js 20 Alpine + OpenSSL 3.x
- HTTP → HTTPS redirect on port 80

## Development

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d postgres redis

# Setup database
cd packages/api && npx prisma db push

# Copy environment
cp .env.example packages/api/.env
# Edit .env with your settings

# Start all services in development
cd packages/api && npm run dev     # API on :3001
cd packages/admin && npm run dev   # Admin on :5173
cd packages/pwa && npm run dev     # PWA on :5174
```

## Monorepo Structure

```
reviewhub/
├── packages/
│   ├── api/          # Backend (Fastify + Prisma)
│   │   ├── src/
│   │   │   ├── modules/       # Feature modules
│   │   │   │   ├── auth/      # JWT auth, registration
│   │   │   │   ├── clients/   # Client CRUD, CSV import
│   │   │   │   ├── reviews/   # Review submission, routing
│   │   │   │   ├── sms/       # Review requests, reminders
│   │   │   │   ├── analytics/ # Dashboard, channel stats
│   │   │   │   ├── settings/  # Company profile, channels
│   │   │   │   ├── sentiment/ # LLM sentiment analysis
│   │   │   │   └── webhooks/  # Telegram/Max webhook handlers
│   │   │   └── services/      # Shared services
│   │   │       ├── encryption.ts      # AES-256-GCM
│   │   │       ├── message-gateway.ts # Multi-channel sender
│   │   │       ├── smsc.ts            # SMSC.ru adapter
│   │   │       ├── telegram.ts        # Telegram Bot API
│   │   │       └── max.ts             # Max Bot API
│   │   ├── prisma/            # Schema & migrations
│   │   └── tests/             # Vitest unit tests
│   ├── admin/        # Admin Panel (React SPA)
│   └── pwa/          # PWA Review Form
├── nginx/            # Nginx configs (dev + prod + SSL)
├── docs/             # SPARC documentation
├── myinsights/       # Development knowledge base (12 insights)
├── docker-compose.yml        # Development
└── docker-compose.prod.yml   # Production (HTTPS, Nginx, SSL)
```

## Key Features

### Multi-Channel Messaging
- **SMS** via SMSC.ru — default channel, always available
- **Telegram** — free delivery via bot, auto-linking through deep link in SMS
- **Max** — Russian messenger support with HMAC webhook authentication
- **Automatic fallback** — if messenger fails, falls back to SMS transparently

### Security
- AES-256-GCM encryption for phone numbers and chat IDs at rest
- JWT access tokens (15 min) + refresh tokens (7 days)
- HMAC-SHA256 webhook verification with constant-time comparison
- Helmet, CORS whitelist, rate limiting (100 req/min)
- 152-ФЗ compliant (Russian data residency)

### Analytics
- Dashboard with SMS/review counts, average rating, trends
- Per-channel breakdown: sent, failed, reviews, conversion rate
- Fallback tracking

## Documentation

### SPARC Docs
- [PRD](docs/PRD.md) — Product Requirements
- [Architecture](docs/Architecture.md) — System Design
- [Specification](docs/Specification.md) — User Stories & API
- [Pseudocode](docs/Pseudocode.md) — Algorithms
- [Refinement](docs/Refinement.md) — Edge Cases & Testing

### Guides
- [Development Guide](DEVELOPMENT_GUIDE.md) — Step-by-step lifecycle

### Bilingual Documentation
- [Русский](README/rus/) — Полная документация на русском
- [English](README/eng/) — Full documentation in English

### Documentation Index
- [README Index](README/index.md) — Table of contents for all docs

## Testing

```bash
cd packages/api && npm test        # Run all tests
cd packages/api && npm run test:watch  # Watch mode
```

Unit tests cover: auth, clients, reviews, SMS, webhooks, analytics, encryption, reminders, templates, LLM.

## License

Private
