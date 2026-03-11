# Развертывание ReviewHub

## Требования

### Сервер (VPS)
- **ОС:** Ubuntu 22.04 LTS
- **CPU:** 4 vCPU
- **RAM:** 8 ГБ
- **Диск:** 100 ГБ SSD
- **Локация:** Москва (требование 152-ФЗ)
- **Провайдер:** AdminVPS или HOSTKEY
- **Стоимость:** 3 000-5 000 руб./мес

### Программное обеспечение
- Docker 24+
- Docker Compose v2
- Git
- OpenSSL (для самоподписанных сертификатов)

## Архитектура Production-стека

Продакшен использует `docker-compose.prod.yml` с отдельной конфигурацией Nginx (`nginx/prod.conf`).

```
Клиент
  |
  ├── :443  → Nginx → Admin Panel (статика) + API (/api/)
  └── :9443 → Nginx → PWA (статика) + API (/api/)
                |
                ├── PostgreSQL 16 (Docker volume)
                └── Redis 7 (Docker volume)
```

- **Админ-панель + API:** порт 443 (HTTPS)
- **PWA (форма отзывов):** порт 9443 (HTTPS)
- **SSL:** самоподписанный сертификат для IP `89.125.130.105`

## Пошаговое развертывание

### 1. Подготовка сервера

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin

# Установка OpenSSL (обычно уже есть)
sudo apt install openssl
```

### 2. Клонирование проекта

```bash
cd /opt
git clone <repo-url> reviewhub
cd reviewhub
```

### 3. Генерация самоподписанного SSL-сертификата

Для развертывания по IP-адресу (без домена) используется самоподписанный сертификат.

```bash
mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout nginx/ssl/selfsigned.key \
  -out nginx/ssl/selfsigned.crt \
  -subj "/CN=89.125.130.105" \
  -addext "subjectAltName=IP:89.125.130.105"
```

Сертификат также монтируется в контейнер API (`/app/ssl/selfsigned.crt`) -- он нужен для регистрации Telegram-вебхука с самоподписанным сертификатом.

### 4. Настройка окружения

```bash
cp .env.example .env.production
nano .env.production
```

Обязательно заполнить:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | Сгенерируйте надёжный пароль |
| `DATABASE_URL` | Подключение к PostgreSQL | `postgresql://reviewhub:ПАРОЛЬ@postgres:5432/reviewhub` |
| `JWT_SECRET` | Секрет для access-токенов | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Секрет для refresh-токенов | `openssl rand -hex 32` |
| `SMSC_LOGIN` | Логин SMSC.ru | Ваш логин |
| `SMSC_PASSWORD` | Пароль SMSC.ru | Ваш пароль |
| `ANTHROPIC_API_KEY` | Ключ API Anthropic Claude | `sk-ant-...` |
| `ENCRYPTION_KEY` | Ключ шифрования телефонов | `openssl rand -hex 32` |
| `WEBHOOK_SECRET` | Секрет для вебхуков (мин. 32 символа) | `openssl rand -hex 32` |
| `APP_URL` | URL админ-панели | `https://89.125.130.105` |
| `PWA_URL` | URL формы отзывов | `https://89.125.130.105:9443` |
| `API_BASE_URL` | Публичный URL API | `https://89.125.130.105` |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота (опционально) | `123456:ABC-DEF...` |
| `MAX_BOT_TOKEN` | Токен Max-бота (опционально) | Токен из Max |

### 5. Сборка и запуск (Production)

```bash
# Сборка и запуск с production-конфигурацией
docker compose -f docker-compose.prod.yml up -d --build

# Применение миграций БД
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Проверка здоровья
curl -k https://localhost/api/health
```

Флаг `-k` нужен для curl при работе с самоподписанным сертификатом.

### 6. Проверка

```bash
# API
curl -k https://89.125.130.105/api/health

# Админ-панель
curl -kI https://89.125.130.105

# PWA
curl -kI https://89.125.130.105:9443
```

В браузере при первом входе появится предупреждение о самоподписанном сертификате -- нажмите "Дополнительно" -> "Перейти на сайт".

## Docker Compose: dev vs prod

### Development (`docker-compose.yml`)

| Сервис | Образ | Порт | Назначение |
|--------|-------|------|------------|
| `api` | node:20-alpine | 3000 | Backend API |
| `admin` | nginx:alpine | -- | Админ-панель (статика) |
| `pwa` | nginx:alpine | -- | PWA форма (статика) |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy + SSL (Let's Encrypt) |
| `certbot` | certbot/certbot | -- | Автообновление сертификатов |
| `postgres` | postgres:16 | 5432 | База данных |
| `redis` | redis:7 | 6379 | Кэш |

### Production (`docker-compose.prod.yml`)

| Сервис | Образ | Порт | Назначение |
|--------|-------|------|------------|
| `api` | node:20-alpine | -- | Backend API (внутренний) |
| `admin` | nginx:alpine | -- | Админ-панель (статика) |
| `pwa` | nginx:alpine | -- | PWA форма (статика) |
| `nginx` | nginx:alpine | 80, 443, 9443 | Reverse proxy + SSL (самоподписанный) |
| `postgres` | postgres:16 | -- | База данных (Docker volume) |
| `redis` | redis:7 | -- | Кэш (Docker volume) |

Ключевые отличия production:
- Нет `certbot` -- используется самоподписанный сертификат
- API-порт не проброшен наружу (доступ только через Nginx)
- Порты PostgreSQL и Redis не проброшены (безопасность)
- Отдельный порт 9443 для PWA
- Выделенная Docker-сеть `reviewhub`
- SSL-сертификат монтируется в контейнер API для Telegram-вебхука

## Monorepo Docker Build: известные проблемы

### Non-hoisted зависимости

В монорепозитории npm не всегда поднимает зависимости в корень. Dockerfile решает это копированием node_modules из обоих уровней:

```dockerfile
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/api/node_modules ./node_modules
```

Второй COPY перезаписывает пакеты из корневого node_modules пакет-специфичными версиями.

### Prisma + OpenSSL

Prisma требует OpenSSL для генерации клиента в Alpine-контейнерах:

```dockerfile
FROM base AS api
RUN apk add --no-cache openssl
```

Без этого `prisma generate` и запросы к БД падают с ошибкой `libssl`.

## Настройка Telegram-вебхука с самоподписанным сертификатом

При использовании самоподписанного сертификата Telegram API требует, чтобы сертификат был загружен при регистрации вебхука. Система делает это автоматически при сохранении токена бота в настройках.

Для этого сертификат монтируется в API-контейнер:

```yaml
# docker-compose.prod.yml
api:
  volumes:
    - ./nginx/ssl/selfsigned.crt:/app/ssl/selfsigned.crt:ro
```

API отправляет сертификат при вызове `setWebhook`:

```
POST https://api.telegram.org/bot{token}/setWebhook
  - url: https://89.125.130.105/api/webhooks/telegram
  - certificate: @/app/ssl/selfsigned.crt
```

Без загрузки сертификата Telegram откажется отправлять обновления на HTTPS-эндпоинт с самоподписанным сертификатом.

## Резервное копирование

### Автоматический бэкап PostgreSQL

```bash
#!/bin/bash
# /opt/reviewhub/backup.sh -- запускать через cron ежедневно в 03:00
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U reviewhub reviewhub | gzip > $BACKUP_DIR/reviewhub_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
echo "Backup complete: reviewhub_$DATE.sql.gz"
```

```cron
0 3 * * * /opt/reviewhub/backup.sh
```

### Восстановление из бэкапа

```bash
# 1. Остановить API (чтобы не было активных подключений)
docker compose -f docker-compose.prod.yml stop api

# 2. Восстановить дамп
gunzip -c /backups/postgres/reviewhub_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reviewhub -d reviewhub

# 3. Запустить API
docker compose -f docker-compose.prod.yml start api

# 4. Проверить
curl -k https://localhost/api/health
```

Для восстановления в чистую базу (например, при миграции на другой сервер):

```bash
# Создать базу
docker compose -f docker-compose.prod.yml exec postgres \
  createdb -U reviewhub reviewhub_new

# Восстановить
gunzip -c backup.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U reviewhub -d reviewhub_new
```

## Откат

```bash
docker compose -f docker-compose.prod.yml down
git checkout <предыдущий-тег>
docker compose -f docker-compose.prod.yml up -d --build
# При необходимости восстановить БД из бэкапа (см. выше)
```

## Обновление

```bash
cd /opt/reviewhub

# 1. Создать бэкап перед обновлением
./backup.sh

# 2. Получить обновления
git pull origin main

# 3. Пересобрать и перезапустить
docker compose -f docker-compose.prod.yml up -d --build

# 4. Применить миграции (если есть)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 5. Проверить
curl -k https://localhost/api/health
```

## CI/CD

Push в `main` -> GitHub Actions -> тесты -> SSH-деплой на VPS.

Конфигурация в `.github/workflows/deploy.yml`. Секреты: `VPS_HOST`, `VPS_USER`, `VPS_KEY`.

## Переход на домен и Let's Encrypt

Когда появится домен, переключитесь на `docker-compose.yml` (с certbot):

1. Настройте DNS A-записи на IP сервера
2. Обновите `APP_URL`, `PWA_URL`, `API_BASE_URL` в `.env.production`
3. Переключитесь на основной `docker-compose.yml`
4. Получите сертификат: `sudo certbot --nginx -d admin.reviewhub.ru -d review.reviewhub.ru`
5. Обновите токен Telegram-бота (вебхук перерегистрируется автоматически)
