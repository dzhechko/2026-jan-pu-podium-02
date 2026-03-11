# Toolkit Harvest Report — ReviewHub

**Date:** 2026-03-11
**Mode:** Quick
**Source Project:** ReviewHub (Podium clone for Russian market)

## Extracted Artifacts (12)

### Patterns (5)
| # | Pattern | Maturity | Description |
|---|---------|----------|-------------|
| 1 | Message Gateway with Multi-Channel Fallback | 🔴 Alpha | Adapter pattern: unified send() across SMS/Telegram/Max with automatic fallback to SMS |
| 2 | Webhook HMAC Authentication | 🔴 Alpha | HMAC-SHA256 token generation + constant-time verification for incoming webhooks |
| 3 | Modular Feature Architecture (routes/service/schema) | 🔴 Alpha | Each API feature as 3 files: routes (HTTP), service (logic), schema (Zod validation) |
| 4 | Prisma Cascade Delete Chain | 🔴 Alpha | onDelete: Cascade across entire ownership hierarchy to prevent FK constraint errors |
| 5 | API Client with Auto Token Refresh | 🔴 Alpha | Generic fetch wrapper: JWT attach → 401 intercept → refresh → retry original request |

### Snippets (4)
| # | Snippet | Maturity | Description |
|---|---------|----------|-------------|
| 1 | AES-256-GCM Encryption Service | 🔴 Alpha | IV+AuthTag+Ciphertext in single Buffer, hex key from env |
| 2 | Zod Environment Validation | 🔴 Alpha | Schema-driven env parsing with type inference and fail-fast |
| 3 | Prisma Pagination Query | 🔴 Alpha | skip/take + count → { data, meta: { total, page, limit } } |
| 4 | Helmet + CORS + Rate Limiting Stack | 🔴 Alpha | Security middleware composition for Fastify |

### Rules (3)
| # | Rule | Maturity | Description |
|---|------|----------|-------------|
| 1 | Error-First Lookup Protocol | 🟡 Beta | grep error signature against indexed knowledge base before debugging |
| 2 | SPARC Completeness Gate | 🟡 Beta | Block implementation until 5 mandatory docs exist |
| 3 | Fastify Content-Type on bodyless requests | 🔴 Alpha | Never set Content-Type: application/json on DELETE/GET without body |

### Templates (0 new)
Docker Compose, Dockerfile, Nginx configs already exist in project — documented but not extracted as standalone templates.

## Skipped (not extracted)
- Domain-specific business logic (review routing, promo codes, reminder cascade)
- SMSC.ru API wrapper (too provider-specific)
- Claude sentiment analysis integration (useful but needs more projects to validate)

## Provenance
- Source: `dzhechko/2026-jan-pu-podium-02`
- Stack: Node.js 20, Fastify 4, Prisma 5, React 18, PostgreSQL 16
- Insights: 8 indexed in `myinsights/1nsights.md`

Last harvest: 2026-03-11
