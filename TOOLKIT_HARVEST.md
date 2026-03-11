# Toolkit Harvest Report — ReviewHub

**Date:** 2026-03-11
**Mode:** Quick (updated)
**Source Project:** ReviewHub (Podium clone for Russian market)

## Extracted Artifacts (18)

### Patterns (8)

| # | Pattern | Maturity | Description |
|---|---------|----------|-------------|
| 1 | Message Gateway with Multi-Channel Fallback | 🔴 Alpha | Adapter pattern: unified send() across SMS/Telegram/Max with automatic fallback to SMS |
| 2 | Webhook HMAC Authentication | 🔴 Alpha | HMAC-SHA256 token generation + constant-time verification for incoming webhooks |
| 3 | Modular Feature Architecture (routes/service/schema) | 🔴 Alpha | Each API feature as 3 files: routes (HTTP), service (logic), schema (Zod validation) |
| 4 | Prisma Cascade Delete Chain | 🔴 Alpha | onDelete: Cascade across entire ownership hierarchy to prevent FK constraint errors |
| 5 | API Client with Auto Token Refresh | 🔴 Alpha | Generic fetch wrapper: JWT attach → 401 intercept → refresh → retry original request |
| 6 | Docker Multi-Stage Build for npm Workspace Monorepo | 🔴 Alpha | Single Dockerfile producing 3 independent targets (api, admin, pwa) via parallel build stages sharing a deps layer |
| 7 | Telegram Webhook with Self-Signed Certificate | 🔴 Alpha | Auto-detect self-signed cert on disk → send as multipart form-data during setWebhook; fallback to JSON if absent |
| 8 | Per-Admin Dynamic Provider Construction | 🔴 Alpha | On each request, decrypt per-tenant encrypted tokens from DB → construct ephemeral provider instances; shared SMS provider from env |

**Pattern 6 — Docker Multi-Stage Build for npm Workspace Monorepo**

- **When to use:** Monorepo with multiple deployable packages (API, SPA, PWA) sharing a root `package-lock.json`.
- **Key insight:** A single `deps` stage copies only `package.json` files from each workspace, runs `npm ci` once. Separate `*-build` stages each `COPY` only their package source. Runtime stages pick from the correct build stage — API gets `node:20-alpine`, SPAs get `nginx:alpine`.
- **Reusable structure:**
  ```
  base → deps → api-build ──→ api (runtime)
               → admin-build → admin (nginx)
               → pwa-build ──→ pwa (nginx)
  ```
- **Gotcha:** The API runtime stage copies `node_modules` from both root and package levels (`/app/node_modules` and `/app/packages/api/node_modules`) — Prisma client and other hoisted deps live at the root.
- **Source:** `/root/2026-jan-pu-podium-02/Dockerfile`

**Pattern 7 — Telegram Webhook with Self-Signed Certificate**

- **When to use:** Deploying Telegram bots on VPS with IP-only access (no domain/Let's Encrypt), common in Russian infrastructure.
- **Key insight:** Telegram's `setWebhook` accepts an optional `certificate` field (PEM file) via multipart form-data. When present, Telegram pins the cert and trusts the self-signed endpoint. The provider checks `existsSync(certPath)` at call time — if cert exists, it sends multipart; otherwise plain JSON (for CA-signed certs).
- **Integration:** Docker Compose mounts the cert as read-only volume: `./nginx/ssl/selfsigned.crt:/app/ssl/selfsigned.crt:ro`
- **Gotcha:** The cert must be the same file used by nginx for TLS termination. Mismatched certs cause silent webhook delivery failures.
- **Source:** `/root/2026-jan-pu-podium-02/packages/api/src/services/telegram.ts` (lines 77-118)

**Pattern 8 — Per-Admin Dynamic Provider Construction**

- **When to use:** Multi-tenant SaaS where each tenant (admin) has their own bot tokens / API keys, stored encrypted in DB.
- **Key insight:** `MessageGateway.getProvidersForAdmin()` decrypts per-admin tokens on every send call and constructs ephemeral `TelegramProvider` / `MaxProvider` instances. SMS provider is shared (env-level credentials). This avoids a provider cache that would need invalidation on token rotation.
- **Trade-off:** Extra DB query + decrypt per message vs. cache complexity. Acceptable at SMB scale (<1000 messages/day per admin).
- **Source:** `/root/2026-jan-pu-podium-02/packages/api/src/services/message-gateway.ts` (lines 73-93)

### Snippets (4)

| # | Snippet | Maturity | Description |
|---|---------|----------|-------------|
| 1 | AES-256-GCM Encryption Service | 🔴 Alpha | IV+AuthTag+Ciphertext in single Buffer, hex key from env |
| 2 | Zod Environment Validation | 🔴 Alpha | Schema-driven env parsing with type inference and fail-fast |
| 3 | Prisma Pagination Query | 🔴 Alpha | skip/take + count → { data, meta: { total, page, limit } } |
| 4 | Helmet + CORS + Rate Limiting Stack | 🔴 Alpha | Security middleware composition for Fastify |

**Snippet 1 — AES-256-GCM Encryption Service (detail update)**

- **Buffer format:** `IV (12 bytes) | AuthTag (16 bytes) | Ciphertext` — single contiguous buffer, no delimiters.
- **Key validation:** Constructor enforces `hexKey.length >= 64` (32 bytes hex-encoded), slices to exactly 64 chars. Prevents truncated keys silently reducing security.
- **When to use:** Encrypting PII at rest (phone numbers, bot tokens, chat IDs) in Prisma `Bytes` columns.
- **When NOT to use:** Password hashing (use bcrypt), large files (use streaming cipher), or when you need searchable encrypted data (use deterministic encryption instead).
- **Source:** `/root/2026-jan-pu-podium-02/packages/api/src/services/encryption.ts`

**Snippet 2 — Zod Environment Validation (detail update)**

- **Pattern:** Define `z.object({...})` schema with `.default()` for optional vars, bare `.string()` for required. Call `.safeParse(process.env)` — on failure, log `flatten().fieldErrors` and `process.exit(1)`.
- **Key insight:** Use `z.coerce.number()` for PORT (env vars are always strings). Use `.min(N)` for secrets (JWT_SECRET min 32, ENCRYPTION_KEY min 64) to catch weak values at startup.
- **Export type:** `export type Env = z.infer<typeof envSchema>` gives full type safety downstream with zero duplication.
- **Source:** `/root/2026-jan-pu-podium-02/packages/api/src/config/env.ts`

### Rules (3)

| # | Rule | Maturity | Description |
|---|------|----------|-------------|
| 1 | Error-First Lookup Protocol | 🟡 Beta | grep error signature against indexed knowledge base before debugging |
| 2 | SPARC Completeness Gate | 🟡 Beta | Block implementation until 5 mandatory docs exist |
| 3 | Fastify Content-Type on bodyless requests | 🔴 Alpha | Never set Content-Type: application/json on DELETE/GET without body |

### Templates (3 new)

| # | Template | Maturity | Description |
|---|----------|----------|-------------|
| 1 | Docker Compose Production with env_file + environment overlay | 🔴 Alpha | Layered config: secrets in `.env.production` (env_file), infrastructure wiring in `environment` block |
| 2 | Nginx Multi-App Reverse Proxy with SSL | 🔴 Alpha | Single nginx routing to multiple upstream apps on different ports, self-signed SSL |
| 3 | Webhook-Friendly Docker Volume Mount | 🔴 Alpha | Mount SSL cert read-only into API container for Telegram webhook registration |

**Template 1 — Docker Compose Production with env_file + environment overlay**

- **When to use:** Production Docker Compose where some vars are secrets (DB passwords, API keys) and others are infrastructure wiring (DATABASE_URL with Docker service names, REDIS_URL).
- **Key pattern:**
  ```yaml
  services:
    api:
      env_file:
        - .env.production    # Secrets: JWT_SECRET, ENCRYPTION_KEY, ANTHROPIC_API_KEY
      environment:
        - NODE_ENV=production
        - DATABASE_URL=postgresql://user:${POSTGRES_PASSWORD:-default}@postgres:5432/db
        - REDIS_URL=redis://redis:6379
  ```
- **Key insight:** `environment` block overrides same-named vars from `env_file`. Use `${VAR:-default}` interpolation for the DB password, referencing the same var used by the postgres service. This keeps the connection string in version control while the actual password stays in `.env.production`.
- **Gotcha:** `depends_on` with `condition: service_healthy` requires a `healthcheck` on the dependency. PostgreSQL healthcheck: `pg_isready -U <user>`.
- **Source:** `/root/2026-jan-pu-podium-02/docker-compose.prod.yml`

**Template 2 — Nginx Multi-App Reverse Proxy with SSL**

- **When to use:** VPS with single IP hosting multiple apps (admin panel, PWA, API) without separate domains.
- **Key pattern:** Port-based routing — admin+API on :443, PWA on :9443. Both share the same self-signed SSL cert. API routes matched by `/api/` prefix, everything else falls through to the SPA upstream.
- **Security headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy — applied globally in the `http` block.
- **Source:** `/root/2026-jan-pu-podium-02/nginx/prod.conf`

**Template 3 — Webhook-Friendly Docker Volume Mount**

- **When to use:** When an API container needs access to the same SSL cert used by nginx, specifically for Telegram Bot API webhook registration with self-signed certificates.
- **Key pattern:**
  ```yaml
  api:
    volumes:
      - ./nginx/ssl/selfsigned.crt:/app/ssl/selfsigned.crt:ro
  ```
- **Key insight:** Mount only the public cert (`.crt`), not the private key. Read-only (`:ro`) flag prevents accidental writes. The API reads this cert at webhook registration time to send to Telegram via `setWebhook`.
- **Source:** `/root/2026-jan-pu-podium-02/docker-compose.prod.yml` (line 10)

## Skipped (not extracted)

- Domain-specific business logic (review routing, promo codes, reminder cascade)
- SMSC.ru API wrapper (too provider-specific, though dev-mode fallback pattern is noted)
- Claude sentiment analysis integration (useful but needs more projects to validate)
- Max Bot API specifics (`bot_started` event vs Telegram `/start`) — too provider-specific for general extraction

## New Observations (not yet artifacts)

These patterns were observed but need validation in a second project before extraction:

- **Fire-and-forget webhook processing:** Routes return 200 immediately, then call `service.process*().catch(log)`. Required by Telegram (retries on non-200) but useful for any webhook receiver. Potential pattern if seen again.
- **Silent failure on webhook validation:** All webhook routes return `{ ok: true }` even on auth failure — never reveal internal state to external callers. Security rule candidate.
- **SmscAdapter wrapping legacy service:** Adapter class to make an existing service conform to a new interface without modifying the original. Classic GoF, but the specific "wrap legacy → new MessageProvider interface" is worth noting.
- **AbortSignal.timeout(N) on all external HTTP calls:** Every `fetch()` call uses `AbortSignal.timeout(10000)` (or 5000 for health checks). Prevents hung connections from blocking the event loop. Snippet candidate.

## Provenance

- Source: `dzhechko/2026-jan-pu-podium-02`
- Stack: Node.js 20, Fastify 4, Prisma 5, React 18, PostgreSQL 16
- Insights: 8 indexed in `myinsights/1nsights.md`

Last harvest: 2026-03-11 (updated)
