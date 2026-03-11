# ReviewHub — Podium Clone for Russian Market

## Project Overview

ReviewHub — платформа автоматического сбора и маршрутизации отзывов для российского SMB. SMS → PWA → LLM-анализ тональности → redirect positive на Яндекс Карты / negative во внутренний dashboard.

**CJM:**
1. Админ отправляет SMS через SMSC.ru (вручную или автоматически)
2. Клиент открывает PWA, оставляет отзыв (звёзды + текст)
3. LLM анализирует тональность
4. Positive → redirect на Яндекс Карты (клиент сам публикует)
5. Negative → скрытый раздел + промокод
6. Каскад напоминаний (2ч → 24ч → 3д → 7д) если нет отзыва

## Architecture

- **Pattern:** Distributed Monolith (Monorepo)
- **Frontend:** React 18 + TypeScript + Vite + Shadcn/ui
- **Backend:** Node.js 20 + Fastify 4 + Prisma 5
- **Database:** PostgreSQL 16, Redis 7
- **SMS:** SMSC.ru API
- **AI:** Anthropic Claude API (sentiment analysis)
- **Infrastructure:** Docker + Docker Compose on VPS (RU, 152-ФЗ)
- **Reverse Proxy:** Nginx

## Tech Stack

| Layer | Technology |
|-------|------------|
| Admin Panel | React 18 + TS + Vite + Shadcn/ui |
| PWA | React 18 + TS (lightweight) |
| API | Node.js 20 + Fastify 4 |
| ORM | Prisma 5 |
| DB | PostgreSQL 16 |
| Cache | Redis 7 |
| SMS | SMSC.ru HTTP API |
| LLM | Anthropic Claude API |
| Deploy | Docker Compose on VPS |

## Monorepo Structure

```
reviewhub/
├── packages/
│   ├── api/          # Backend (Fastify + Prisma)
│   ├── admin/        # Admin Panel (React SPA)
│   └── pwa/          # PWA Review Form
├── nginx/            # Nginx config
├── docs/             # SPARC documentation
├── docker-compose.yml
└── Dockerfile
```

## Key Constraints

- **Яндекс Карты:** НЕТ API для публикации — только redirect клиента по ссылке
- **152-ФЗ:** Все данные хранятся на российском VPS
- **SMS opt-out:** Обязательная ссылка на отписку в каждом SMS
- **Cascade limit:** Максимум 4 напоминания на один review request

## Parallel Execution Strategy

- Use `Task` tool for independent subtasks
- Run tests, linting, type-checking in parallel
- Build admin + pwa + api in parallel
- For complex features: spawn specialized agents

## Available Agents

| Agent | Purpose |
|-------|---------|
| planner | Feature planning with pseudocode algorithms |
| code-reviewer | Quality review + edge cases |
| architect | System design decisions |

## Feature Development Lifecycle

New features use the 4-phase lifecycle: `/feature [name]`
1. **PLAN** — sparc-prd-mini (with Gate + external skills) → `docs/features/<n>/sparc/`
2. **VALIDATE** — requirements-validator swarm → score ≥70 (HARD GATE)
3. **IMPLEMENT** — parallel agents from validated docs
4. **REVIEW** — brutal-honesty-review swarm → fix all criticals

Available lifecycle skills in `.claude/skills/`:
- `sparc-prd-mini` (orchestrator, delegates to explore, goap-research, problem-solver-enhanced)
- `explore` (Socratic questioning → Product Brief)
- `goap-research-ed25519` (GOAP A* + OODA → Research Findings)
- `problem-solver-enhanced` (9 modules + TRIZ → Solution Strategy)
- `requirements-validator`
- `brutal-honesty-review`

## Available Commands

| Command | Description |
|---------|-------------|
| /start | Bootstrap project from docs |
| /feature [name] | Full 4-phase lifecycle (plan → validate → implement → review) |
| /go [feature] | Auto-select pipeline (/plan, /feature) and implement |
| /run [mvp\|all] | Bootstrap + implement features in loop |
| /plan [feature] | Plan implementation |
| /test [scope] | Run/generate tests |
| /deploy [env] | Deploy to environment |
| /myinsights [title] | Capture development insight to knowledge base |
| /docs [rus\|eng] | Generate bilingual documentation |
| /next [id] | Show roadmap, suggest next task, mark done |
| /replicate | Full pipeline (already done) |
| /harvest | Extract reusable knowledge |

## Automation Commands

- `/go [feature]` — auto-select pipeline (/plan, /feature, /feature-ent) and implement
- `/run` or `/run mvp` — bootstrap + implement all MVP features in a loop
- `/run all` — bootstrap + implement ALL features
- `/docs` — generate bilingual documentation (RU/EN) in /README/

## Development Insights

Index: [myinsights/1nsights.md](myinsights/1nsights.md) — check here FIRST before debugging.
On error → grep the error string in the index → read only the matched detail file.
Capture new findings: `/myinsights [title]`

### Known Insights
- Sentiment threshold: confidence ≥ 0.7 for positive routing
- Star rating fallback: ≥ 4 stars = positive when LLM unavailable
- SMS batch size: 50 per SMSC.ru API call
- Reminder timing: 2h, 24h, 3d, 7d from initial SMS

## Feature Roadmap

Roadmap: [.claude/feature-roadmap.json](.claude/feature-roadmap.json) — single source of truth for feature status.
Sprint progress and next steps are injected automatically at session start.
Quick check: `/next` | Full overview: ask "what should I work on?"
Mark done: `/next [feature-id]` | Update all: `/next update`

## Implementation Plans

Plans: `docs/plans/` — auto-committed on session end.

## SPARC Documentation

Read these before implementing:
1. `docs/PRD.md` — Product Requirements
2. `docs/Specification.md` — User Stories + Acceptance Criteria
3. `docs/Pseudocode.md` — Algorithms + API Contracts
4. `docs/Architecture.md` — System Design + DB Schema
5. `docs/Refinement.md` — Edge Cases + Testing
6. `docs/Completion.md` — Deployment + CI/CD
