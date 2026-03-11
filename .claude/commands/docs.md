---
description: Generate or update project documentation in Russian and English.
  Creates a comprehensive set of markdown files covering deployment, usage,
  architecture, and user flows.
  $ARGUMENTS: optional flags — "rus" (Russian only), "eng" (English only), "update" (refresh existing)
---

# /docs $ARGUMENTS

## Purpose

Generate professional, bilingual project documentation from source code,
existing docs, and development insights. Output: `README/rus/` and `README/eng/`.

## Step 1: Gather Context

Read all available sources:

### Primary sources:
```
docs/PRD.md                          — product requirements, features
docs/Architecture.md                 — system architecture, tech stack
docs/Specification.md                — API, data model, user stories
docs/Completion.md                   — deployment, environment setup
docs/features/                       — feature-specific documentation
CLAUDE.md                            — project overview, commands, agents
DEVELOPMENT_GUIDE.md                 — development workflow
docker-compose.yml                   — infrastructure services
.env.example                         — environment variables
```

### Secondary sources:
```
myinsights/1nsights.md               — development insights index
.claude/feature-roadmap.json         — feature list and statuses
```

## Step 2: Determine Scope

```
IF $ARGUMENTS contains "rus":  languages = ["rus"]
ELIF $ARGUMENTS contains "eng": languages = ["eng"]
ELSE: languages = ["rus", "eng"]

IF $ARGUMENTS contains "update":
    mode = "update"  — read existing README/ files, update only changed sections
ELSE:
    mode = "create"  — generate from scratch
```

## Step 3: Generate Documentation Set

For EACH language, generate these files in `README/<lang>/`:

1. `deployment.md` — Развертывание / Deployment Guide
2. `admin-guide.md` — Руководство администратора / Admin Guide
3. `user-guide.md` — Руководство пользователя / User Guide
4. `infrastructure.md` — Требования к инфраструктуре / Infrastructure
5. `architecture.md` — Архитектура системы / Architecture
6. `ui-guide.md` — Интерфейс / UI Guide
7. `user-flows.md` — Пользовательские сценарии / User & Admin Flows

Plus `README/index.md` — table of contents linking both languages.

## Step 4: Commit and Report

```bash
git add README/
git commit -m "docs: generate project documentation (RU/EN)"
git push origin HEAD
```
