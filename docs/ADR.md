# Architecture Decision Records: ReviewHub

## ADR-001: Distributed Monolith over Microservices

**Status:** Accepted
**Context:** Need to choose architecture pattern for MVP. Team is small (1-2 developers).
**Decision:** Distributed Monolith in Monorepo — single API server with clearly separated modules.
**Rationale:**
- Simpler deployment and debugging than microservices
- Clear module boundaries allow future extraction
- Docker Compose handles all services
- Monorepo enables shared types and easy refactoring
**Consequences:**
- Must maintain module boundaries discipline
- Single point of failure (mitigated by Docker restart policies)

## ADR-002: Node.js + Fastify over alternatives

**Status:** Accepted
**Context:** Backend runtime/framework selection.
**Decision:** Node.js 20 LTS + Fastify 4
**Alternatives Considered:**
- Python + FastAPI — good for AI, but less frontend ecosystem alignment
- Go + Gin — performant, but slower development speed for MVP
- Elixir + Phoenix — Podium's choice, but niche talent pool in Russia
**Rationale:**
- Fastify is 2-3x faster than Express
- Full TypeScript support (shared types with React frontend)
- Large npm ecosystem for integrations
- Easy to find Node.js developers in Russia
**Consequences:**
- Single-threaded (use worker threads for CPU-heavy if needed)

## ADR-003: PostgreSQL as primary database

**Status:** Accepted
**Context:** Need ACID-compliant database with encryption support.
**Decision:** PostgreSQL 16
**Rationale:**
- JSONB for flexible data (SMS templates, settings)
- pgcrypto extension for field-level encryption
- Prisma ORM has excellent PostgreSQL support
- Proven at scale, free, well-documented
**Consequences:**
- Need connection pooling (Prisma handles this)
- Backup strategy required (pg_dump)

## ADR-004: SMSC.ru as SMS provider

**Status:** Accepted (user-specified)
**Context:** Need Russian SMS provider with API.
**Decision:** SMSC.ru
**Rationale:**
- 25+ years on market, reliable
- HTTP API (simple integration)
- 92% delivery rate
- Supports SMS, Viber, Voice
- Cost: ~2-3 RUB/SMS
**Consequences:**
- Vendor lock-in (mitigated by abstraction layer)
- Need fallback provider for reliability

## ADR-005: Redirect approach for Yandex Maps reviews

**Status:** Accepted (forced by technical constraint)
**Context:** Yandex Maps has NO public API for posting reviews.
**Decision:** Redirect positive customers to Yandex Maps review page via deep link.
**Rationale:**
- Only technically feasible approach
- Same approach used by Podium for Google Reviews
- Organic reviews (user writes themselves) are more trustworthy
- No risk of Yandex moderation blocking
**Consequences:**
- Lower conversion than auto-posting would have been
- Depends on customer actually completing the review on Yandex
- Must track redirect clicks (can't track if review was actually left)

## ADR-006: LLM for sentiment over traditional NLP

**Status:** Accepted
**Context:** Need to classify review sentiment (positive/negative).
**Decision:** Use Anthropic Claude API with simple prompt.
**Alternatives Considered:**
- Rule-based (keyword matching) — too many false positives
- Custom ML model — expensive to train and maintain
- Pre-trained sentiment models (e.g., rusentiment) — less accurate for nuanced text
**Rationale:**
- 95%+ accuracy on Russian text
- No model training required
- Cost: ~$0.001-0.003 per review (negligible)
- Can handle nuanced, mixed sentiment
**Consequences:**
- External API dependency (mitigated by star-rating fallback)
- Latency ~1-3s per request (acceptable for async flow)

## ADR-007: PWA over native mobile app

**Status:** Accepted
**Context:** Customer review form needs to work on mobile.
**Decision:** Progressive Web App (React).
**Rationale:**
- No app store installation required
- Opens directly from SMS link
- Works on all devices (iOS + Android)
- Faster development than native
- Target bundle size <100KB
**Consequences:**
- Limited access to device features (not needed for review form)
- No push notifications (use SMS instead)

## ADR-008: Docker Compose deployment on VPS

**Status:** Accepted
**Context:** Need 152-ФЗ compliant hosting in Russia.
**Decision:** Docker Compose on Russian VPS (AdminVPS/HOSTKEY).
**Alternatives Considered:**
- Yandex Cloud — more expensive for MVP
- Kubernetes — over-engineering for initial scale
- Heroku/Vercel — not 152-ФЗ compliant (non-RU data centers)
**Rationale:**
- Simple deployment and management
- Cost-effective (~₽3-5K/month for 4vCPU, 8GB RAM)
- Full control over infrastructure
- Easy to migrate to cloud later
**Consequences:**
- Manual scaling (acceptable for MVP)
- Need own monitoring and backup setup
- SSH-based deployment (GitHub Actions)
