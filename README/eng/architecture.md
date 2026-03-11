# ReviewHub System Architecture

## Overview

ReviewHub is built as a **distributed monolith** in a monorepo. A single backend (Node.js/Fastify) with modular structure, two frontends (admin panel + PWA), containerized via Docker Compose.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
├────────────────────┬────────────────────────────────────────┤
│   Admin Panel      │   PWA Review Form                      │
│   React + TS       │   React + TS (lightweight)             │
│   admin.app.com    │   review.app.com/:token                │
└─────────┬──────────┴──────────┬─────────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 NGINX (Reverse Proxy + SSL)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              API SERVER (Node.js 20 + Fastify 4)             │
│                                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│   │ Auth     │ │ Clients  │ │ Reviews  │ │ Analytics     │  │
│   │ Module   │ │ Module   │ │ Module   │ │ Module        │  │
│   └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│   ┌──────────┐ ┌──────────┐ ┌────────────────────────────┐  │
│   │ SMS      │ │ Sentiment│ │ Settings Module            │  │
│   │ Module   │ │ Module   │ │                            │  │
│   └────┬─────┘ └────┬─────┘ └────────────────────────────┘  │
└────────┼────────────┼────────────────────────────────────────┘
         │            │
         ▼            ▼
┌──────────────┐ ┌──────────────┐
│  SMSC.ru     │ │  Claude API  │
│  (SMS)       │ │  (Sentiment) │
└──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       DATA LAYER                             │
│   ┌──────────────┐  ┌──────────┐                             │
│   │ PostgreSQL 16│  │ Redis 7  │                             │
│   │ (primary DB) │  │ (cache)  │                             │
│   └──────────────┘  └──────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend (Admin) | React 18 + TS + Vite + Tailwind | Modern, fast |
| Frontend (PWA) | React 18 + TS + Vite | Lightweight PWA |
| Backend | Node.js 20 + Fastify 4 | Performance, TypeScript |
| ORM | Prisma 5 | Type-safe, migrations |
| Database | PostgreSQL 16 | Reliable, JSONB support |
| Cache | Redis 7 | Rate limiting, sessions |
| SMS | SMSC.ru API | Russian provider |
| AI | Anthropic Claude API | Best Russian language support |
| Proxy | Nginx | SSL, static files, routing |
| Containers | Docker + Docker Compose | Reproducible |

## Database Schema

### Core Tables

```
admins (companies)
├── id (UUID, PK)
├── email (UNIQUE)
├── password_hash (bcrypt)
├── company_name
├── phone
├── yandex_maps_url
├── yandex_org_id
├── discount_percent (default 10)
└── discount_text

clients (customers)
├── id (UUID, PK)
├── admin_id (FK → admins)
├── name
├── phone_encrypted (BYTEA, AES-256-GCM)
├── email_encrypted (BYTEA)
└── opted_out (boolean)

review_requests
├── id (UUID, PK)
├── admin_id (FK → admins)
├── client_id (FK → clients)
├── token (UNIQUE, 32 hex)
├── status (PENDING → SMS_SENT → REVIEWED/OPTED_OUT/EXPIRED)
├── reminder_count (0-4)
├── next_reminder_at
└── expires_at

reviews
├── id (UUID, PK)
├── review_request_id (FK)
├── admin_id (FK)
├── stars (1-5)
├── text
├── sentiment (POSITIVE/NEGATIVE/NEUTRAL)
├── sentiment_confidence (0.0-1.0)
├── routed_to (YANDEX_REDIRECT/INTERNAL_HIDDEN)
└── promo_code

sms_logs
├── id (UUID, PK)
├── review_request_id (FK)
├── phone_masked (+790****67)
├── status (QUEUED/SENT/DELIVERED/FAILED)
└── reminder_number (0-4)
```

## Security

### Authentication
- JWT access tokens (15 min)
- Refresh tokens (7 days)
- bcrypt (cost 12) for passwords
- Rate limit: 5 attempts / 15 min per IP

### Data Encryption
- Phones: AES-256-GCM (encrypted at rest)
- Encryption key: environment variable
- TLS 1.3 for all connections
- CORS: domain whitelist

### 152-FZ Compliance
- All data stored on Russian VPS
- SMS consent recorded
- Opt-out link in every SMS
- Data deletion API available

## Module Structure

```
packages/
├── api/                    # Backend
│   └── src/modules/
│       ├── auth/           # Registration, login, tokens
│       ├── clients/        # Client CRUD, encryption
│       ├── reviews/        # Reviews, routing
│       ├── sms/            # SMS integration
│       ├── sentiment/      # AI sentiment analysis
│       ├── analytics/      # Dashboard metrics
│       └── settings/       # Company profile
├── admin/                  # Admin Panel (React SPA)
└── pwa/                    # PWA Review Form
```

Each module contains: `routes.ts`, `service.ts`, `schema.ts`.
