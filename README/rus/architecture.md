# Архитектура системы ReviewHub

## Обзор

ReviewHub построен как **распределённый монолит** в монорепозитории. Единый backend (Node.js/Fastify) с модульной структурой, два фронтенда (админ-панель + PWA), containerized через Docker Compose.

## Диаграмма архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                        КЛИЕНТЫ                               │
├────────────────────┬────────────────────────────────────────┤
│   Админ-панель     │   PWA Форма отзыва                     │
│   React + TS       │   React + TS (lightweight)             │
│   admin.app.com    │   review.app.com/:token                │
└─────────┬──────────┴──────────┬─────────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 NGINX (Reverse Proxy + SSL)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              API SERVER (Node.js 20 + Fastify 4)             │
│                                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│   │ Auth     │ │ Clients  │ │ Reviews  │ │ Analytics     │  │
│   │ Module   │ │ Module   │ │ Module   │ │ Module        │  │
│   └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│   ┌──────────┐ ┌──────────┐ ┌────────────────────────────┐  │
│   │ SMS      │ │ Sentiment│ │ Settings Module            │  │
│   │ Module   │ │ Module   │ │                            │  │
│   └────┬─────┘ └────┬─────┘ └────────────────────────────┘  │
└────────┼────────────┼────────────────────────────────────────┘
         │            │
         ▼            ▼
┌──────────────┐ ┌──────────────┐
│  SMSC.ru     │ │  Claude API  │
│  (SMS)       │ │  (Sentiment) │
└──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      СЛОЙ ДАННЫХ                             │
│   ┌──────────────┐  ┌──────────┐                             │
│   │ PostgreSQL 16│  │ Redis 7  │                             │
│   │ (основная БД)│  │ (кэш)    │                             │
│   └──────────────┘  └──────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

## Стек технологий

| Слой | Технология | Обоснование |
|------|------------|-------------|
| Фронтенд (админ) | React 18 + TS + Vite + Tailwind | Современный, быстрый |
| Фронтенд (PWA) | React 18 + TS + Vite | Легковесная PWA |
| Backend | Node.js 20 + Fastify 4 | Производительность, TS |
| ORM | Prisma 5 | Типобезопасность, миграции |
| База данных | PostgreSQL 16 | Надёжность, JSONB |
| Кэш | Redis 7 | Rate limiting, сессии |
| SMS | SMSC.ru API | Российский провайдер |
| AI | Anthropic Claude API | Лучшая поддержка русского |
| Proxy | Nginx | SSL, статика, маршрутизация |
| Контейнеры | Docker + Docker Compose | Воспроизводимость |

## Схема базы данных

### Основные таблицы

```
admins (компании)
├── id (UUID, PK)
├── email (UNIQUE)
├── password_hash (bcrypt)
├── company_name
├── phone
├── yandex_maps_url
├── yandex_org_id
├── discount_percent (default 10)
└── discount_text

clients (клиенты)
├── id (UUID, PK)
├── admin_id (FK → admins)
├── name
├── phone_encrypted (BYTEA, AES-256-GCM)
├── email_encrypted (BYTEA)
└── opted_out (boolean)

review_requests (запросы на отзыв)
├── id (UUID, PK)
├── admin_id (FK → admins)
├── client_id (FK → clients)
├── token (UNIQUE, 32 hex)
├── status (PENDING → SMS_SENT → REVIEWED/OPTED_OUT/EXPIRED)
├── reminder_count (0-4)
├── next_reminder_at
└── expires_at

reviews (отзывы)
├── id (UUID, PK)
├── review_request_id (FK)
├── admin_id (FK)
├── stars (1-5)
├── text
├── sentiment (POSITIVE/NEGATIVE/NEUTRAL)
├── sentiment_confidence (0.0-1.0)
├── routed_to (YANDEX_REDIRECT/INTERNAL_HIDDEN)
└── promo_code

sms_logs (логи SMS)
├── id (UUID, PK)
├── review_request_id (FK)
├── phone_masked (+790****67)
├── status (QUEUED/SENT/DELIVERED/FAILED)
└── reminder_number (0-4)
```

## Безопасность

### Аутентификация
- JWT access-токены (15 мин)
- Refresh-токены (7 дней)
- bcrypt (cost 12) для паролей
- Rate limit: 5 попыток / 15 мин на IP

### Шифрование данных
- Телефоны: AES-256-GCM (зашифрованы в БД)
- Ключ шифрования: переменная окружения
- TLS 1.3 для всех соединений
- CORS: whitelist доменов

### 152-ФЗ
- Все данные — на российском VPS
- Согласие на SMS фиксируется
- Ссылка отписки в каждом SMS
- API удаления данных

## Модульная структура

```
packages/
├── api/                    # Backend
│   └── src/modules/
│       ├── auth/           # Регистрация, логин, токены
│       ├── clients/        # CRUD клиентов, шифрование
│       ├── reviews/        # Отзывы, маршрутизация
│       ├── sms/            # SMS-интеграция
│       ├── sentiment/      # AI-анализ тональности
│       ├── analytics/      # Дашборд метрик
│       └── settings/       # Профиль компании
├── admin/                  # Админ-панель (React SPA)
└── pwa/                    # PWA форма отзыва
```

Каждый модуль содержит: `routes.ts`, `service.ts`, `schema.ts`.
