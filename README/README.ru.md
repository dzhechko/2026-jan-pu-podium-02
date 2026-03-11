# ReviewHub

Платформа автоматического сбора и маршрутизации отзывов для российского малого бизнеса.

## Возможности

| Функция | Описание |
|---------|----------|
| SMS-рассылка | Отправка запросов на отзыв через SMSC.ru |
| PWA-форма | Мобильная форма: звёзды + текст, брендинг компании |
| AI-анализ | LLM анализирует тональность (Anthropic Claude) |
| Маршрутизация | Позитивные → Яндекс Карты, негативные → скрытый раздел + промокод |
| Каскад напоминаний | 4 SMS: 2ч → 24ч → 3д → 7д с отменой при получении отзыва |
| SMS-шаблоны | Кастомизация текста SMS на каждом шаге |
| Аналитика | Дашборд: конверсия, тренды, статистика SMS |
| 152-ФЗ | Данные на российском VPS, шифрование, opt-out |

## Архитектура

```
Клиент ──SMS──> PWA ──отзыв──> API ──LLM──> маршрутизация
                                │               │
                           PostgreSQL      Яндекс / Скрытый
                               │
                         node-cron (напоминания)
```

## Технологии

- **Frontend:** React 18 + TypeScript + Vite + Shadcn/ui
- **Backend:** Node.js 20 + Fastify 4 + Prisma 5
- **БД:** PostgreSQL 16, Redis 7
- **SMS:** SMSC.ru HTTP API
- **AI:** Anthropic Claude API
- **Деплой:** Docker Compose + Nginx + Let's Encrypt

## Быстрый старт

```bash
npm install
docker compose up -d postgres redis
cd packages/api && npx prisma migrate dev
npm run dev
```

## Структура

```
packages/
├── api/          # Backend (Fastify + Prisma)
├── admin/        # Админ-панель (React SPA)
└── pwa/          # PWA форма отзыва
nginx/            # Nginx конфиг
scripts/          # Deploy скрипты
docs/             # SPARC документация
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/register | Регистрация |
| POST | /api/auth/login | Авторизация |
| POST | /api/auth/refresh | Обновление токена |
| GET/PUT | /api/settings | Настройки компании |
| GET/POST | /api/clients | CRUD клиентов |
| POST | /api/clients/import | Импорт CSV |
| POST | /api/review-requests | Отправка SMS |
| GET | /api/review-requests | Список запросов |
| PUT/GET/DELETE | /api/sms-templates | Шаблоны SMS |
| GET | /api/reviews/form/:token | Данные формы |
| POST | /api/reviews/submit/:token | Отправка отзыва |
| POST | /api/reviews/optout/:token | Отписка |
| GET | /api/reviews | Список отзывов (админ) |
| GET | /api/analytics | Аналитика |

## Деплой (продакшн)

```bash
cp .env.production.example .env.production
# Заполнить реальные значения

./scripts/deploy.sh --init-ssl  # Первый запуск (получение SSL)
./scripts/deploy.sh             # Последующие деплои
```

## Тесты

```bash
cd packages/api && npm test     # 48 unit тестов
```

## Лицензия

Проприетарный
