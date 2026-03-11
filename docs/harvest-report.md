# Harvest Report: ReviewHub

## Reusable Patterns Extracted

### 1. Encrypted Field Pattern
**Source:** `packages/api/src/services/encryption.ts`
**Pattern:** AES-256-GCM with IV+AuthTag+Ciphertext format
**Reusable for:** Any project needing field-level encryption at rest
**Key insight:** Validate key length strictly, validate data length on decrypt

### 2. Cascade Scheduler Pattern
**Source:** `packages/api/src/services/reminder.ts`
**Pattern:** node-cron + batch query + progressive delay scheduling
**Reusable for:** Any multi-step notification system (email drip, onboarding)
**Key insight:** Don't advance on failure (auto-retry next tick), process in batches

### 3. Sentiment Routing Pattern
**Source:** `packages/api/src/modules/sentiment/service.ts`
**Pattern:** LLM analysis + confidence threshold + star rating fallback
**Reusable for:** Any review/feedback routing system
**Key insight:** Always have a non-LLM fallback, centralize threshold constants

### 4. Template Interpolation Pattern
**Source:** `packages/api/src/modules/sms/template-service.ts`
**Pattern:** Upsert per (owner, slot) + placeholder validation + default fallback
**Reusable for:** Email templates, notification templates, any customizable messaging
**Key insight:** Validate required placeholders at save time, not send time

### 5. JWT Auth + Refresh Pattern
**Source:** `packages/api/src/modules/auth/service.ts`
**Pattern:** Short-lived access (15m) + long-lived refresh (7d) + bcrypt
**Reusable for:** Any Fastify/Express API with JWT auth
**Key insight:** Need token blacklisting for logout (not implemented here — add Redis)

### 6. Multi-Stage Docker Build Pattern
**Source:** `Dockerfile`
**Pattern:** deps → parallel builds (api/admin/pwa) → slim runtime stages
**Reusable for:** Any monorepo with separate frontend/backend packages
**Key insight:** Copy node_modules from build stage, not from deps

### 7. Fastify Module Pattern
**Source:** `packages/api/src/modules/*/`
**Pattern:** service.ts (logic) + routes.ts (HTTP) + schema.ts (Zod validation)
**Reusable for:** Any Fastify API project
**Key insight:** Inject dependencies via constructor, keep routes thin

### 8. Phone Masking Pattern
**Source:** Multiple files
**Pattern:** `phone.slice(0, 4) + '****' + phone.slice(-2)`
**Reusable for:** Any PII masking in logs/audit

## Anti-Patterns Found (Avoid in Future Projects)

1. **Zero-padded encryption keys** — always reject weak keys
2. **Hardcoded secrets with defaults** — require in production, fail early
3. **Duplicate fallback logic** — centralize immediately, don't copy-paste
4. **console.log in services** — always use injected logger
5. **Magic numbers** — extract to named constants from day 1

## Architecture Decisions Worth Preserving

| Decision | Rationale |
|----------|-----------|
| Distributed monolith | Simple to deploy, easy to split later |
| Prisma ORM | Type-safe, no raw SQL risk |
| node-cron (not Bull/BullMQ) | MVP simplicity, single instance |
| AES-256-GCM (not bcrypt) | Fast encrypt/decrypt for phone numbers |
| Star fallback for sentiment | Graceful degradation when LLM is down |
