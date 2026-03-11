# ReviewHub - Executive Summary

## Overview

ReviewHub — платформа автоматического сбора и интеллектуальной маршрутизации отзывов для российского малого и среднего бизнеса. Решает проблему низкого рейтинга на Яндекс Картах через автоматизированную SMS-рассылку, PWA-форму для отзывов, AI-анализ тональности и умную маршрутизацию.

## Problem & Solution

**Problem:** 6.7M SMB в России теряют клиентов из-за низкого рейтинга. Нет доступного инструмента для автоматического сбора отзывов. Podium ($400/мес) не работает в РФ, RocketData (₽15K+/мес) — только мониторинг.

**Solution:** SMS → PWA → LLM-анализ → маршрутизация. Позитивные отзывы → redirect на Яндекс Карты (клиент сам публикует). Негативные → скрытый раздел для работы с жалобами. Каскад напоминаний (4 SMS) с психологически обоснованным алгоритмом.

## Target Users

- **Primary:** Владельцы/админы SMB (стоматологии, автосервисы, салоны, клиники)
- **Secondary:** Клиенты бизнеса (получатели SMS)

## Key Features (MVP)

1. **Админ-панель** — управление клиентами, рассылки, аналитика
2. **SMS через SMSC.ru** — рассылка запросов на отзыв
3. **PWA Review Form** — мобильная форма (оценка + текст)
4. **AI Sentiment Analysis** — LLM анализ тональности
5. **Smart Routing** — positive → Яндекс Карты redirect, negative → internal
6. **Cascade Reminders** — 4-step (2ч → 24ч → 3д → 7д)

## Technical Approach

- **Architecture:** Distributed Monolith (Monorepo)
- **Tech Stack:** React 18, Node.js 20 + Fastify, PostgreSQL 16, Redis, Docker
- **Integrations:** SMSC.ru (SMS), Anthropic Claude API (sentiment), Яндекс Карты (redirect)
- **Infrastructure:** VPS в Москве (152-ФЗ compliance)
- **Key Differentiator:** Единственное решение SMS + отзывы + AI-анализ за ₽3-10K/мес

## Research Highlights

1. **Яндекс Карты не имеет API для публикации отзывов** — только redirect клиента
2. **SMSC.ru** — 25+ лет, 92% доставляемость, API, ~2-3 руб/SMS
3. **Рынок ORM в РФ ₽50B+** — ни один конкурент не покрывает полный цикл
4. **Оптимальный алгоритм:** 4 напоминания с ростом incentive, стоп после 7 дней
5. **Конверсия SMS→отзыв:** ожидаемая 15-25% (с incentive)

## Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Платящие клиенты | 100 | 6 мес |
| MRR | ₽500K | 6 мес |
| SMS→отзыв конверсия | 15-25% | Ongoing |
| Рост рейтинга клиентов | +0.3 | Per 3 мес |
| Trial-to-Paid | 15-20% | Ongoing |

## Timeline & Phases

| Phase | Features | Timeline |
|-------|----------|----------|
| MVP | Auth, clients, manual SMS, PWA, LLM, redirect, analytics | Month 1-2 |
| v1.0 | CSV import, cascades, SMS tracking, templates, promo codes | Month 3-4 |
| v1.1 | CRM webhooks, auto-trigger, API | Month 5-6 |
| v2.0 | Google Maps, 2GIS, Telegram, WhatsApp | Month 7-9 |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Яндекс блокирует "подозрительные" отзывы | Organic timing, не батчить redirect'ы |
| Низкая SMS→отзыв конверсия | A/B тестирование текстов + увеличение incentive |
| SMSC.ru outage | Fallback SMS provider (SMS.ru) |
| 152-ФЗ compliance | Hosting в РФ, opt-out, consent tracking |

## Immediate Next Steps

1. Настроить проект (Docker Compose, Prisma schema, базовая структура)
2. Реализовать auth + admin panel (регистрация, логин)
3. Интегрировать SMSC.ru API (отправка SMS)
4. Создать PWA review form
5. Подключить LLM для sentiment analysis
6. Реализовать routing logic + analytics dashboard

## Documentation Package

- PRD.md — Product Requirements
- Solution_Strategy.md — Problem Analysis
- Specification.md — User Stories & Acceptance Criteria
- Pseudocode.md — Algorithms & API Contracts
- Architecture.md — System Design & Tech Stack
- Refinement.md — Testing & Edge Cases
- Completion.md — Deployment & Operations
- Research_Findings.md — Market & Technology Research
- Product_Discovery_Brief.md — Discovery Phase Output
