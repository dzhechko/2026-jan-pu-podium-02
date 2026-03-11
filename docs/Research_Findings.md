# Research Findings: ReviewHub (Podium Clone Russia)

## Executive Summary

ReviewHub — платформа автоматического сбора и маршрутизации отзывов для российского SMB. Рынок ORM в РФ ₽50B+, 6.7M SMB без интегрированного решения. Ключевое ограничение: Яндекс Карты не имеет API для публикации отзывов — реализация через redirect клиента.

## Research Objective

1. Как работает Podium и что применимо в России?
2. Как реализовать публикацию отзывов на Яндекс Картах?
3. Какой SMS-провайдер использовать?
4. Какой алгоритм напоминаний оптимален?

## Methodology

- Анализ Podium.com (продукт, pricing, tech)
- Обзор русского ORM-рынка (Wazzup24, Chat2Desk, RocketData)
- Исследование Yandex Maps API / Yandex Business API
- Исследование SMSC.ru
- Behavioral psychology для алгоритма напоминаний

---

## Market Analysis

### Podium (Original)
- Основана 2014, $3B valuation, 100K+ бизнесов, $100M+ ARR
- Pricing: $399-$599/мес (Core-Pro)
- Stack: Elixir/Phoenix, React, PostgreSQL + Cassandra, AWS
- AI Agent "Jerry": GPT-5.1, 98.6% F1-score
- Land-and-expand: review management → upsell messaging, payments

### Российский рынок
- TAM: ₽50B+ (ORM + messaging)
- SAM: ₽5B (SMB сектор услуг)
- 6.7M SMB в РФ, 3-6% используют SaaS
- Gap: никто не объединяет SMS + сбор отзывов + AI-анализ + маршрутизацию

### Competitive Landscape

| Competitor | Strengths | Weaknesses | Opportunity |
|------------|-----------|------------|-------------|
| Wazzup24 | CRM-интеграция, ₽800-6K/мес | Нет отзывов, нет AI | + Reviews + AI |
| Chat2Desk | Много каналов | Скрытые комиссии | + Transparent pricing |
| RocketData | Мониторинг Яндекс/Google | ₽15K+/мес, только мониторинг | + SMS + 5x дешевле |
| Pact.im | Мультиканальность | Проблемы надёжности | + Stability + Reviews |

---

## Technology Assessment

### Яндекс Карты — Отзывы (КРИТИЧЕСКИ ВАЖНО)

1. **НЕТ публичного API для публикации отзывов** — только вручную через UI
2. **НЕТ API для ответов** — только через кабинет Яндекс Бизнеса
3. Модерация: AI + ручная, до 2 недель
4. Ответы модерируются до 3 дней
5. Один ответ на отзыв, нельзя отвечать на анонимные
6. Undocumented endpoint `yandex.ru/maps/api/business/fetchReviews` (CSRF) — ненадёжен
7. Third-party scraping (Apify) — только чтение
8. Rocket Data / Pointer — возможно private/partner API

**Решение:** Redirect клиента по ссылке `https://yandex.ru/maps/org/{org_id}/reviews/` — клиент сам оставляет отзыв. Это стандартный подход Podium.

**Confidence:** High

### SMSC.ru (SMS Provider)

- 25+ лет, 92% доставляемость
- Каналы: SMS, Viber, Email, Voice
- HTTP REST API
- ~2-3 руб/SMS
- Мониторинг доставки в реальном времени

### LLM для тональности

- Claude API / OpenAI API для sentiment analysis
- Prompt: определить тональность + confidence score
- Threshold: score ≥ 0.7 positive → redirect
- ~$0.001-0.003 за запрос

---

## Behavioral Research: Алгоритм напоминаний

### Принципы

1. **Timing Effect** — лучшее время: 1-2ч после услуги (peak-end rule)
2. **Reciprocity** — скидка повышает конверсию в 3-5x
3. **Ease of action** — 1 клик → PWA → отзыв
4. **Diminishing returns** — после 4 напоминаний раздражение > конверсия
5. **Variable messaging** — разные формулировки снижают "слепоту"

### Оптимальный алгоритм

| # | Когда | Сообщение | Принцип |
|---|-------|-----------|---------|
| 1 | 2ч после услуги | "Как вам визит? Отзыв = скидка 10%" | Peak-end + Reciprocity |
| 2 | 24ч | "Ваше мнение важно! Отзыв за 30 секунд" | Ease of action |
| 3 | 3 дня | "Скидка 15% за отзыв — 48ч осталось" | Scarcity |
| 4 | 7 дней | "Последнее напоминание: бонус за отзыв" | Finality |
| STOP | После 4 SMS или отзыва | — | Diminishing returns |

---

## Confidence Assessment

- **High:** Яндекс API ограничения, SMSC.ru, Podium model
- **Medium:** TAM/SAM, алгоритм напоминаний, конверсии
- **Low:** Точный CAC, SaaS adoption rate

## Sources

1. Podium.com — официальный сайт
2. Research Gist — gist.github.com/dzhechko/9d8ee3d994f058369ee17dbb9882a3a3
3. Yandex Maps API Docs — yandex.com/maps-api/docs
4. Yandex Business Support — yandex.com/support/business-priority/en/manage/reviews
5. Habr Q&A — подтверждение отсутствия Reviews API (сотрудник Яндекса)
6. SMSC.ru — smsc.ru
7. promopult/yandex-business-api — github.com/promopult/yandex-business-api
