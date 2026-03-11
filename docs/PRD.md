# Product Requirements Document

**Product:** ReviewHub
**Version:** 0.1
**Last Updated:** 2026-03-11
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Purpose
ReviewHub — платформа автоматического сбора и маршрутизации отзывов для российского SMB. Полный цикл: SMS-рассылка → PWA → AI-анализ тональности → маршрутизация (positive → Яндекс Карты, negative → скрытый раздел).

### 1.2 Scope

**In Scope:**
- Админ-панель (управление клиентами, рассылки, аналитика)
- SMS через SMSC.ru API
- PWA для сбора отзывов
- LLM-анализ тональности
- Маршрутизация: positive → redirect Яндекс Карты, negative → скрытый раздел
- Каскад напоминаний (4-step)
- Базовая аналитика

**Out of Scope (v1):**
- CRM-интеграция (AmoCRM, Bitrix24)
- Мессенджеры (WhatsApp, Telegram)
- Мульти-платформа (Google Maps, 2GIS)
- AI-генерация ответов
- Платёжная система
- White-label

### 1.3 Definitions

| Term | Definition |
|------|------------|
| PWA | Progressive Web App |
| Sentiment | Тональность отзыва (positive/negative/neutral) |
| Redirect | Перенаправление клиента на Яндекс Карты |
| Cascade | Серия SMS-напоминаний (2ч→24ч→3д→7д) |

---

## 2. Product Vision

### 2.1 Vision Statement
> Сделать управление репутацией доступным для каждого малого бизнеса в России.

### 2.2 Problem Statement
**Problem:** SMB теряет клиентов из-за низкого рейтинга на Яндекс Картах. Ручной сбор отзывов неэффективен, существующие инструменты дороги (₽15K+) или неполны.

**Impact:** Бизнес с рейтингом 4.5+ получает на 30-50% больше обращений.

### 2.3 Success Metrics

| Metric | Target (6 мес) |
|--------|----------------|
| Платящие клиенты | 100 |
| MRR | ₽500K |
| Конверсия SMS→отзыв | 15-25% |
| Рост рейтинга клиентов | +0.3 за 3 мес |
| Trial-to-Paid | 15-20% |
| Monthly Churn | <5% |

---

## 3. Target Users

### 3.1 Primary: Админ (представитель бизнеса)

| Attribute | Description |
|-----------|-------------|
| **Role** | Владелец/админ SMB (стоматология, автосервис, салон) |
| **Goals** | Увеличить рейтинг на Яндекс Картах |
| **Pain Points** | Нет времени просить отзывы |
| **Tech Level** | Low-Medium |

### 3.2 Secondary: Клиент (получатель SMS)

| Attribute | Description |
|-----------|-------------|
| **Role** | Клиент, получивший услугу |
| **Goals** | Получить скидку, поделиться опытом |
| **Pain Points** | Лень, нет мотивации |

### 3.3 Anti-Personas
- Корпорации с ORM-отделом
- Бизнес без клиентской базы с телефонами
- Только-онлайн компании

---

## 4. Functional Requirements

### 4.1 Админ-панель

| ID | User Story | Priority |
|----|-----------|----------|
| US-001 | As Админ, I want to register/login | Must |
| US-002 | As Админ, I want to import clients (CSV/manual) | Must |
| US-003 | As Админ, I want to set company profile + Yandex Maps link | Must |
| US-004 | As Админ, I want to send SMS review request manually | Must |
| US-005 | As Админ, I want to auto-send after service | Should |
| US-006 | As Админ, I want to see analytics (SMS, reviews, conversion) | Must |
| US-007 | As Админ, I want to see all reviews (positive + negative) | Must |
| US-008 | As Админ, I want to customize SMS templates | Should |
| US-009 | As Админ, I want to set discount amount | Should |

### 4.2 SMS Engine

| ID | User Story | Priority |
|----|-----------|----------|
| US-010 | System sends SMS via SMSC.ru API | Must |
| US-011 | System runs cascade reminders (2h, 24h, 3d, 7d) | Must |
| US-012 | System stops reminders after review received | Must |
| US-013 | System tracks SMS delivery status | Should |

### 4.3 PWA Review Form

| ID | User Story | Priority |
|----|-----------|----------|
| US-014 | As Client, open PWA via SMS link | Must |
| US-015 | As Client, rate (1-5 stars) + write text | Must |
| US-016 | As Client, see discount offer | Must |
| US-017 | As Client, get redirected to Yandex Maps (positive) | Must |
| US-018 | As Client, receive promo code | Must |

### 4.4 Sentiment Analysis

| ID | User Story | Priority |
|----|-----------|----------|
| US-019 | System sends review to LLM API for sentiment | Must |
| US-020 | System routes: positive→redirect, negative→internal | Must |
| US-021 | System uses star rating as fallback | Should |

### 4.5 Negative Reviews

| ID | User Story | Priority |
|----|-----------|----------|
| US-022 | As Админ, see negative reviews in dashboard | Must |
| US-023 | As Админ, respond to negative reviews internally | Should |

## 5. Non-Functional Requirements

### Performance
| Metric | Requirement |
|--------|-------------|
| PWA Load | < 2s (3G) |
| API p99 | < 500ms |
| SMS Throughput | 100/min |
| LLM Analysis | < 3s |

### Security
| Requirement | Implementation |
|-------------|----------------|
| Auth | JWT + refresh tokens |
| Data at rest | AES-256 |
| Transit | TLS 1.3 |
| Compliance | 152-ФЗ (данные в РФ) |
| Opt-out | В каждом SMS |

### Scalability
| Dimension | MVP | Year 1 | Year 3 |
|-----------|-----|--------|--------|
| Admins | 100 | 1,000 | 10,000 |
| SMS/month | 50K | 500K | 5M |
| Reviews/month | 10K | 100K | 1M |

---

## 6. User Journeys

### Admin: Send review request
1. Login → Admin Panel
2. Select client(s)
3. Click "Send Review Request"
4. System sends SMS via SMSC.ru
5. View delivery status
6. Monitor incoming reviews

### Customer: Leave review
1. Receive SMS with link
2. Open PWA
3. See company + discount offer
4. Rate (1-5) + write text
5. Submit
6. LLM analyzes sentiment
7a. Positive → "Leave on Yandex Maps too?" → Redirect
7b. Negative → "Thanks for feedback. Promo code: XXX"
8. Receive promo code

---

## 7. Release Strategy

### MVP (Month 1-2)
- Admin auth, client DB (manual), manual SMS, PWA form, LLM sentiment, redirect, basic analytics

### v1.0 (Month 3-4)
- CSV import, cascade reminders, SMS tracking, templates, promo codes, detailed analytics

### Future
| Phase | Features |
|-------|----------|
| v1.1 | CRM webhooks, auto-trigger |
| v2.0 | Google Maps, 2GIS, Telegram/WhatsApp |
| v3.0 | AI responses, CRM integrations, white-label |

---

## 8. Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| Low SMS→review conversion | Med | High | A/B test + incentives |
| Yandex blocks "suspicious" reviews | Med | High | Organic timing, stagger |
| SMSC.ru outage | Low | High | Fallback SMS.ru |
| 152-ФЗ non-compliance | Low | High | RU hosting |
| Spam complaints | Med | Med | 4 SMS limit + opt-out |
