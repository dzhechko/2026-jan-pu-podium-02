# ReviewHub — Development Guide

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd reviewhub
npm install

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Setup database
cd packages/api
cp .env.example .env
npx prisma migrate dev

# 4. Start development
npm run dev  # starts all packages
```

## Development Lifecycle

### 1. Plan Feature
```
/plan [feature-name]
```
Reads SPARC docs, creates implementation plan in `docs/features/`.

### 2. Implement
Follow the plan, implement in order:
1. Database migration (if needed)
2. Backend API endpoint
3. Frontend UI
4. Tests

### 3. Test
```
/test [feature-name]
```
Run unit, integration, and e2e tests.

### 4. Review
Code reviewer agent checks against SPARC specs, security rules, edge cases.

### 5. Deploy
```
/deploy staging   # test on staging
/deploy production # deploy to prod
```

## Feature Implementation Order (MVP)

| # | Feature | User Stories | Dependencies |
|---|---------|-------------|--------------|
| 1 | Project Setup | — | — |
| 2 | Admin Auth | US-001 | Setup |
| 3 | Company Profile | US-003 | Auth |
| 4 | Client Management | US-002 | Auth |
| 5 | SMS Integration | US-010 | Clients |
| 6 | PWA Review Form | US-014, US-015, US-016 | SMS |
| 7 | Sentiment Analysis | US-019, US-020, US-021 | PWA |
| 8 | Review Routing | US-017, US-022 | Sentiment |
| 9 | Analytics Dashboard | US-006, US-007 | Reviews |
| 10 | Cascade Reminders | US-011, US-012 | SMS |

## Key Integration Points

### SMSC.ru SMS API
```
Base URL: https://smsc.ru/sys/send.php
Auth: login + password (env vars)
Params: phones, mes, sender
Status: https://smsc.ru/sys/status.php
```

### Anthropic Claude API (Sentiment)
```
Endpoint: POST https://api.anthropic.com/v1/messages
Model: claude-haiku-4-5-20251001 (fast + cheap for sentiment)
Prompt: "Analyze sentiment: return {sentiment, confidence}"
Fallback: star rating >= 4 = positive
```

### Yandex Maps (Redirect)
```
Review page: https://yandex.ru/maps/org/{org_id}/reviews/
Extract org_id from admin's Yandex Maps URL
No API — redirect only
```

## Environment Variables

See `docs/Completion.md` for full list. Key ones:
- `DATABASE_URL` — PostgreSQL connection
- `SMSC_LOGIN`, `SMSC_PASSWORD` — SMS provider
- `ANTHROPIC_API_KEY` — LLM for sentiment
- `ENCRYPTION_KEY` — Phone number encryption
- `JWT_SECRET` — Auth tokens

## Useful Commands

| Command | Description |
|---------|-------------|
| `/start` | Bootstrap project from scratch |
| `/plan [feature]` | Create implementation plan |
| `/test` | Run all tests |
| `/deploy [env]` | Deploy to staging/production |

## Documentation

All SPARC documents in `docs/`:
- PRD.md, Specification.md, Pseudocode.md
- Architecture.md, Refinement.md, Completion.md
- Research_Findings.md, C4_Diagrams.md, ADR.md
- validation-report.md, test-scenarios.md
