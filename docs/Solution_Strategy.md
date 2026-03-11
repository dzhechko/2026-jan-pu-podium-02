# Solution Strategy: ReviewHub

## Problem Statement (SCQA)

- **Situation:** 6.7M SMB в России зависят от отзывов на Яндекс Картах. 93% потребителей читают отзывы перед покупкой.
- **Complication:** Нет инструмента для автоматизации SMS→отзыв→AI-маршрутизация. Podium не работает в РФ. Существующие решения дороги или неполны.
- **Question:** Как создать платформу сбора и маршрутизации отзывов для российского рынка?
- **Answer:** ReviewHub — PWA + админ-панель + SMSC.ru + LLM sentiment + redirect на Яндекс Карты.

## First Principles Analysis

### Фундаментальные истины:
1. Отзывы влияют на бизнес — выше рейтинг = больше клиентов
2. Люди ленивы — без стимула и простого процесса отзыв не оставят
3. SMS доставляется — 92%+ open rate vs 20% email
4. LLM анализирует тональность — accuracy >95%, стандартная задача
5. Яндекс Карты = главная платформа отзывов в РФ — но нет API для публикации

### Выводы:
- Максимально упростить: SMS → 1 клик → PWA → отзыв
- Incentivize: скидка повышает конверсию в 3-5x
- AI-маршрутизация: positive → Яндекс redirect, negative → internal dashboard
- SMS через SMSC.ru — лучший канал для РФ

## Root Cause Analysis (5 Whys)

**Проблема: У бизнеса мало отзывов на Яндекс Картах**

1. Why? → Клиенты не оставляют отзывы
2. Why? → Никто не просит и нет мотивации
3. Why? → Нет автоматизированного инструмента
4. Why? → Существующие решения дороги или не покрывают полный цикл
5. Why? → **Root Cause:** Отсутствие доступной платформы SMS→отзыв→маршрутизация для SMB

## Contradictions Resolved (TRIZ)

| Contradiction | TRIZ Principle | Resolution |
|---------------|----------------|------------|
| Яндекс нет API для публикации отзывов | #13 "Other Way Round" | Не публикуем — перенаправляем клиента (он сам оставляет) |
| SMS дорого, но нужно много напоминаний | #1 "Segmentation" | Каскад 4 SMS с ростом incentive, стоп после отзыва |
| LLM дорого для каждого отзыва | #35 "Parameter Change" | Простой prompt (дёшево) + rule-based fallback |
| Нужна персонализация, но это MVP | #10 "Prior Action" | Шаблоны сейчас, данные для персонализации → v2 |

## Recommended Approach (MVP CJM)

```
Admin Panel → SMSC.ru API → SMS → Customer → PWA Review Form
                                                    ↓
                                            LLM Sentiment Analysis
                                                 ↓          ↓
                                          Positive       Negative
                                              ↓              ↓
                                       Redirect to     Save to hidden
                                       Yandex Maps     section on site

Reminder Engine: 4-step cascade (2h → 24h → 3d → 7d)
```

### Key Components
1. **Admin Panel (Web)** — клиенты, рассылки, аналитика
2. **PWA Review Form** — мобильная форма (без установки)
3. **SMS Engine** — SMSC.ru API + каскад напоминаний
4. **Sentiment Engine** — LLM API для тональности
5. **Review Router** — маршрутизация по результату
6. **Analytics Dashboard** — отзывы, конверсия, рейтинг

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SMSC.ru downtime | Low | High | Fallback SMS.ru |
| LLM API unavailable | Low | Medium | Rule-based fallback |
| Яндекс меняет ссылки | Low | Medium | Мониторинг |
| Низкая конверсия SMS→отзыв | Medium | High | A/B тест текстов |
| 152-ФЗ compliance | Low | High | Hosting в РФ |
| Жалобы на спам | Medium | Medium | Лимит 4 SMS + opt-out |
| Яндекс блокирует "накрутку" | Medium | High | Organic redirect, stagger timing |
