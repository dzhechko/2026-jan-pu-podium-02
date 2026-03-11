# Architecture: ReviewHub

## Architecture Overview

### Architecture Style
Distributed Monolith in Monorepo — единый backend с чётким разделением на модули, containerized через Docker, deployed на VPS.

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                              │
├──────────────────┬──────────────────────────────────────┤
│  Admin Panel     │  PWA Review Form                     │
│  (React SPA)     │  (React PWA)                         │
│  admin.app.com   │  review.app.com/:token               │
└────────┬─────────┴──────────┬───────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                   NGINX (Reverse Proxy)                  │
│              SSL Termination + Static Files              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 API SERVER (Node.js / Fastify)           │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth     │ │ Clients  │ │ Reviews  │ │ Analytics │  │
│  │ Module   │ │ Module   │ │ Module   │ │ Module    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │ SMS      │ │ Sentiment│ │ Reminder Scheduler       │ │
│  │ Service  │ │ Service  │ │ (node-cron)              │ │
│  └─────┬────┘ └─────┬────┘ └──────────────────────────┘ │
└────────┼────────────┼───────────────────────────────────┘
         │            │
         ▼            ▼
┌──────────────┐ ┌──────────────┐
│  SMSC.ru     │ │  LLM API     │
│  (SMS API)   │ │  (Claude/    │
│              │ │   OpenAI)    │
└──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│                                                         │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ PostgreSQL   │  │ Redis    │  │ File Storage      │  │
│  │ (primary DB) │  │ (cache,  │  │ (CSV uploads)     │  │
│  │              │  │  queue)  │  │                   │  │
│  └──────────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Admin Panel (Frontend)
- **Tech:** React 18 + TypeScript + Vite
- **UI:** Shadcn/ui (Tailwind CSS)
- **State:** React Query (TanStack Query) for server state
- **Router:** React Router v6
- **Auth:** JWT stored in httpOnly cookies
- **Build:** Static SPA served by Nginx

### 2. PWA Review Form (Frontend)
- **Tech:** React 18 + TypeScript + Vite
- **Separate build** from Admin (lightweight, fast load)
- **PWA:** Service Worker for offline support, manifest.json
- **Design:** Mobile-first, minimal (company logo, stars, text field, submit)
- **Size target:** <100KB initial bundle

### 3. API Server (Backend)
- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify 4 (faster than Express, built-in validation)
- **ORM:** Prisma (type-safe, migrations, PostgreSQL)
- **Validation:** Zod schemas
- **Auth:** JWT (jose library) + bcrypt
- **API docs:** Auto-generated OpenAPI/Swagger

### 4. SMS Service
- **Integration:** SMSC.ru HTTP API
- **Library:** Custom thin wrapper (fetch-based)
- **Features:** Send, check status, balance check
- **Retry:** 3 attempts with exponential backoff (1s, 2s, 4s)

### 5. Sentiment Service
- **Integration:** Anthropic Claude API (primary) or OpenAI API (fallback)
- **Prompt:** Structured JSON response for sentiment + confidence
- **Fallback:** Star-rating based routing when API unavailable
- **Cache:** No caching (each review is unique)

### 6. Reminder Scheduler
- **Implementation:** node-cron job running every 5 minutes
- **Logic:** Query DB for pending reminders, process in batches
- **Concurrency:** Single instance (no distributed locking needed for MVP)

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend (Admin) | React 18 + TS + Vite + Shadcn/ui | Modern, fast, component library |
| Frontend (PWA) | React 18 + TS + Vite | Lightweight PWA |
| Backend | Node.js 20 + Fastify 4 | Performance, TypeScript support |
| ORM | Prisma 5 | Type-safe, migrations |
| Database | PostgreSQL 16 | Reliable, JSONB support |
| Cache/Queue | Redis 7 | Session cache, rate limiting |
| SMS | SMSC.ru API | RU provider, reliable |
| LLM | Anthropic Claude API | Best Russian language support |
| Reverse Proxy | Nginx | SSL, static files, routing |
| Containers | Docker + Docker Compose | Reproducible, portable |
| Infrastructure | VPS (AdminVPS/HOSTKEY) | 152-ФЗ compliance (RU) |
| CI/CD | GitHub Actions → SSH deploy | Simple, effective |

---

## Data Architecture

### Database Schema (PostgreSQL)

```sql
-- Admins (companies)
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  yandex_maps_url TEXT,
  yandex_org_id VARCHAR(100),
  discount_percent INTEGER DEFAULT 10,
  discount_text TEXT DEFAULT 'Скидка на следующий визит',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_encrypted BYTEA NOT NULL,
  email_encrypted BYTEA,
  opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clients_admin ON clients(admin_id);

-- SMS Templates
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL, -- 0=initial, 1-4=reminders
  message_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review Requests
CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  reminder_count INTEGER DEFAULT 0,
  sms_sent_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rr_token ON review_requests(token);
CREATE INDEX idx_rr_next_reminder ON review_requests(next_reminder_at)
  WHERE status NOT IN ('REVIEWED', 'OPTED_OUT', 'EXPIRED');

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID REFERENCES review_requests(id),
  admin_id UUID REFERENCES admins(id),
  client_id UUID REFERENCES clients(id),
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  text TEXT NOT NULL,
  sentiment VARCHAR(10), -- POSITIVE, NEGATIVE, NEUTRAL
  sentiment_confidence FLOAT,
  routed_to VARCHAR(20), -- YANDEX_REDIRECT, INTERNAL_HIDDEN
  promo_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reviews_admin ON reviews(admin_id);

-- SMS Logs
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id UUID REFERENCES review_requests(id),
  phone_masked VARCHAR(20) NOT NULL, -- +7900***4567
  message_preview VARCHAR(100),
  smsc_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'QUEUED',
  reminder_number INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Security Architecture

### Authentication
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry, stored in httpOnly cookie)
- Password hashing: bcrypt (cost 12)
- Rate limit on login: 5 attempts per 15 min per IP

### Data Protection
- Phone numbers encrypted at rest (AES-256-GCM)
- Encryption key from environment variable
- TLS 1.3 for all connections
- CORS restricted to known origins
- CSRF tokens for state-changing operations

### 152-ФЗ Compliance
- All data stored on Russian VPS
- Consent recorded before SMS sending
- Opt-out mechanism in every SMS
- Data deletion on admin request
- No data transfer outside Russia

---

## Monorepo Structure

```
reviewhub/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── packages/
│   ├── api/                    # Backend (Fastify)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── clients/
│   │   │   │   ├── reviews/
│   │   │   │   ├── sms/
│   │   │   │   ├── sentiment/
│   │   │   │   └── analytics/
│   │   │   ├── services/
│   │   │   │   ├── smsc.ts
│   │   │   │   ├── llm.ts
│   │   │   │   └── reminder.ts
│   │   │   ├── config/
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   ├── admin/                  # Admin Panel (React SPA)
│   │   ├── src/
│   │   └── package.json
│   └── pwa/                    # PWA Review Form
│       ├── src/
│       └── package.json
├── nginx/
│   └── nginx.conf
└── package.json                # Root (workspaces)
```

---

## Infrastructure

### Docker Compose Services

| Service | Image | Ports | Resources |
|---------|-------|-------|-----------|
| api | node:20-alpine | 3000 | 512MB RAM |
| admin | nginx:alpine | 80 (static) | 64MB RAM |
| pwa | nginx:alpine | 80 (static) | 64MB RAM |
| postgres | postgres:16 | 5432 | 1GB RAM |
| redis | redis:7-alpine | 6379 | 128MB RAM |
| nginx | nginx:alpine | 80, 443 | 64MB RAM |

### VPS Requirements (MVP)
- 4 vCPU, 8GB RAM, 100GB SSD
- Ubuntu 22.04 LTS
- Location: Moscow (RU)
- Provider: AdminVPS or HOSTKEY
- Estimated cost: ₽3,000-5,000/мес
