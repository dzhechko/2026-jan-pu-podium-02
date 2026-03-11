# Развертывание ReviewHub

## Требования

### Сервер (VPS)
- **ОС:** Ubuntu 22.04 LTS
- **CPU:** 4 vCPU
- **RAM:** 8 ГБ
- **Диск:** 100 ГБ SSD
- **Локация:** Москва (требование 152-ФЗ)
- **Провайдер:** AdminVPS или HOSTKEY
- **Стоимость:** 3 000–5 000 руб./мес

### Программное обеспечение
- Docker 24+
- Docker Compose v2
- Git
- Certbot (для SSL)

## Пошаговое развертывание

### 1. Подготовка сервера

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin

# Установка certbot
sudo apt install certbot python3-certbot-nginx
```

### 2. Клонирование проекта

```bash
cd /opt
git clone <repo-url> reviewhub
cd reviewhub
```

### 3. Настройка окружения

```bash
cp .env.example .env
nano .env
```

Обязательно заполнить:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `DATABASE_URL` | Подключение к PostgreSQL | `postgresql://reviewhub:ПАРОЛЬ@postgres:5432/reviewhub` |
| `JWT_SECRET` | Секрет для access-токенов | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Секрет для refresh-токенов | `openssl rand -hex 32` |
| `SMSC_LOGIN` | Логин SMSC.ru | Ваш логин |
| `SMSC_PASSWORD` | Пароль SMSC.ru | Ваш пароль |
| `ANTHROPIC_API_KEY` | Ключ API Anthropic Claude | `sk-ant-...` |
| `ENCRYPTION_KEY` | Ключ шифрования телефонов | `openssl rand -hex 32` |
| `WEBHOOK_SECRET` | Секрет для вебхуков (мин. 32 символа) | `openssl rand -hex 32` |
| `APP_URL` | URL админ-панели | `https://admin.reviewhub.ru` |
| `PWA_URL` | URL формы отзывов | `https://review.reviewhub.ru` |
| `API_BASE_URL` | Публичный URL API | `https://admin.reviewhub.ru` |

### 4. Запуск сервисов

```bash
# Сборка и запуск
docker compose up -d

# Применение миграций БД
docker compose exec api npx prisma migrate deploy

# Проверка здоровья
curl http://localhost:3000/api/health
```

### 5. Настройка DNS

Создать A-записи:

| Домен | Тип | Значение |
|-------|-----|----------|
| `admin.reviewhub.ru` | A | IP сервера |
| `review.reviewhub.ru` | A | IP сервера |

### 6. Настройка SSL

```bash
sudo certbot --nginx -d admin.reviewhub.ru -d review.reviewhub.ru
```

### 7. Проверка

```bash
# API
curl https://admin.reviewhub.ru/api/health

# Админ-панель
curl -I https://admin.reviewhub.ru

# PWA
curl -I https://review.reviewhub.ru
```

## Docker Compose сервисы

| Сервис | Образ | Порт | Назначение |
|--------|-------|------|------------|
| `api` | node:20-alpine | 3000 | Backend API |
| `admin` | nginx:alpine | — | Админ-панель (статика) |
| `pwa` | nginx:alpine | — | PWA форма (статика) |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy + SSL |
| `postgres` | postgres:16 | 5432 | База данных |
| `redis` | redis:7 | 6379 | Кэш |

## Откат

```bash
docker compose down
git checkout <предыдущий-тег>
docker compose up -d
# При необходимости восстановить БД из бэкапа
```

## Резервное копирование

Автоматический бэкап PostgreSQL:

```bash
#!/bin/bash
# /opt/reviewhub/backup.sh — запускать через cron ежедневно в 03:00
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U reviewhub reviewhub | gzip > $BACKUP_DIR/reviewhub_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
```

```cron
0 3 * * * /opt/reviewhub/backup.sh
```

## CI/CD

Push в `main` → GitHub Actions → тесты → SSH-деплой на VPS.

Конфигурация в `.github/workflows/deploy.yml`. Секреты: `VPS_HOST`, `VPS_USER`, `VPS_KEY`.
