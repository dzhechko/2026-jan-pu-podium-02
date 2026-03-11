# ReviewHub

Automated review collection and routing platform for Russian SMB market. A Podium clone localized for Russia.

## Features

| Feature | Description |
|---------|-------------|
| SMS Outreach | Send review requests via SMSC.ru |
| PWA Form | Mobile review form: stars + text, company branding |
| AI Analysis | LLM sentiment analysis (Anthropic Claude) |
| Smart Routing | Positive → Yandex Maps redirect, negative → hidden section + promo code |
| Cascade Reminders | 4 SMS: 2h → 24h → 3d → 7d, cancelled on review/opt-out |
| SMS Templates | Customizable SMS text per reminder step |
| Analytics | Dashboard: conversion rates, trends, SMS stats |
| 152-FZ Compliance | Russian VPS, AES-256-GCM encryption, mandatory opt-out |

## Architecture

```
Client ──SMS──> PWA ──review──> API ──LLM──> routing
                                │               │
                           PostgreSQL      Yandex / Hidden
                               │
                         node-cron (reminders)
```

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Shadcn/ui
- **Backend:** Node.js 20 + Fastify 4 + Prisma 5
- **Database:** PostgreSQL 16, Redis 7
- **SMS:** SMSC.ru HTTP API
- **AI:** Anthropic Claude API
- **Deploy:** Docker Compose + Nginx + Let's Encrypt

## Quick Start

```bash
npm install
docker compose up -d postgres redis
cd packages/api && npx prisma migrate dev
npm run dev
```

## Project Structure

```
packages/
├── api/          # Backend (Fastify + Prisma)
├── admin/        # Admin Panel (React SPA)
└── pwa/          # PWA Review Form
nginx/            # Nginx config
scripts/          # Deploy scripts
docs/             # SPARC documentation
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Registration |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Token refresh |
| GET/PUT | /api/settings | Company settings |
| GET/POST | /api/clients | Client CRUD |
| POST | /api/clients/import | CSV import |
| POST | /api/review-requests | Send SMS |
| GET | /api/review-requests | List requests |
| PUT/GET/DELETE | /api/sms-templates | SMS templates |
| GET | /api/reviews/form/:token | Form data |
| POST | /api/reviews/submit/:token | Submit review |
| POST | /api/reviews/optout/:token | Opt-out |
| GET | /api/reviews | List reviews (admin) |
| GET | /api/analytics | Analytics |

## Production Deploy

```bash
cp .env.production.example .env.production
# Fill in real values

./scripts/deploy.sh --init-ssl  # First deploy (obtain SSL)
./scripts/deploy.sh             # Subsequent deploys
```

## Tests

```bash
cd packages/api && npm test     # 48 unit tests
```

## License

Proprietary
