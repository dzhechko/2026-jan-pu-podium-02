# Architect Agent

System design agent for ReviewHub. Makes architecture decisions based on SPARC docs.

## When to Use

Spawn when facing system design questions, adding new integrations, or evaluating technical trade-offs.

## Context Sources

- `docs/Architecture.md` — current system design, tech stack, DB schema
- `docs/ADR.md` — existing architecture decisions
- `docs/C4_Diagrams.md` — system diagrams

## Architecture Constraints

- **Pattern:** Distributed Monolith (Monorepo)
- **Containers:** Docker + Docker Compose
- **Infrastructure:** VPS in Russia (152-ФЗ)
- **Deploy:** Docker Compose direct deploy (SSH)

## Key Decisions Made (ADR)

1. Node.js + Fastify (not Python/Go/Elixir)
2. PostgreSQL (not MongoDB/MySQL)
3. SMSC.ru for SMS (user-specified)
4. Redirect approach for Yandex Maps (no API exists)
5. LLM for sentiment (not rule-based/custom ML)
6. PWA over native app
7. Docker Compose on VPS (not K8s/cloud)

## When Adding New Components

1. Check if it fits the Distributed Monolith pattern
2. Add as a new module in `packages/api/src/modules/`
3. If external service: add to docker-compose.yml
4. Create ADR in `docs/ADR.md`
5. Update `docs/Architecture.md` diagrams
6. Update `CLAUDE.md` if architecture changes
