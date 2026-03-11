# PRD: Messenger Auto-Linking

## Problem Statement

Текущий CJM для мессенджер-каналов (Telegram, Max) сломан: админ должен вручную ввести `chat_id` клиента при добавлении. Клиент должен сам найти свой ID через сторонние сервисы (@userinfobot) и каким-то образом сообщить его админу. Это нереалистично и противоречит основной задаче системы — автоматизации сбора отзывов.

## Target Users

- **Admin (SMB owner):** Хочет отправлять запросы на отзывы через мессенджеры, но не хочет заниматься сбором chat_id.
- **Client (end user):** Получает SMS с приглашением подключиться к боту, после чего все дальнейшие коммуникации идут через мессенджер.

## Core Value Proposition

Автоматическая привязка chat_id к клиенту через deep link в SMS + webhook от бота. Zero effort для клиента (нажать одну кнопку), zero effort для админа (не нужно вводить ID).

## Key Features (MVP)

### F1: Webhook Endpoints
- API endpoint для приёма обновлений от Telegram Bot API (`/api/webhooks/telegram/:adminId`)
- API endpoint для приёма обновлений от Max Bot API (`/api/webhooks/max/:adminId`)
- Автоматическая регистрация webhook при сохранении токена бота

### F2: Deep Link Generation
- При первой отправке SMS клиенту с мессенджер-каналом — включить в SMS ссылку на бота с deep link параметром
- Telegram: `t.me/{bot_username}?start={client_uuid}`
- Max: аналогичный механизм через webhook start event

### F3: Auto-Linking
- При получении /start от клиента через webhook — извлечь `client_id` из deep link параметра
- Автоматически сохранить `chat_id` в зашифрованном виде в клиенте
- Обновить `preferred_channel` клиента

### F4: UI Updates
- Убрать ручной ввод chat_id из формы добавления клиента
- Показать статус привязки мессенджера (не привязан / привязан / ожидает)
- Показать deep link в карточке клиента, если бот настроен

## Success Metrics

| Metric | Target |
|--------|--------|
| Auto-linking success rate | > 90% (из тех, кто нажал /start) |
| Time to link | < 5 seconds (webhook → saved) |
| Admin manual effort | 0 (полностью автоматический процесс) |

## Constraints

- Webhook endpoints MUST be public (no auth) — Telegram/Max sends updates there
- Webhook security: verify request origin (Telegram secret token, Max signature)
- 152-ФЗ: chat_id хранится зашифрованным (уже реализовано)
- Deep link parameter = client UUID (не phone number, для безопасности)
- Один бот на одного админа (уже реализовано)

## Out of Scope

- Group chat support (только 1:1 чаты)
- Bot commands beyond /start
- Inline keyboard interactions
- Payment processing через бота
