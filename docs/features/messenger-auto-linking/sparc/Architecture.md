# Architecture: Messenger Auto-Linking

## Architecture Overview

This feature adds webhook endpoints and auto-linking logic to the existing ReviewHub API. No new services or containers are needed — it extends the current Fastify backend with new routes and service methods.

## Component Diagram

```
                          ┌─────────────────┐
                          │   Telegram API   │
                          │   (sends webhooks│
                          │    on /start)    │
                          └────────┬────────┘
                                   │ POST /api/webhooks/telegram/:adminId
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                     API SERVER (Fastify)                      │
│                                                              │
│  ┌─────────────────────┐   ┌──────────────────────────────┐  │
│  │  Webhook Routes     │   │  Settings Routes (existing)  │  │
│  │  (NEW — public)     │   │  + registerWebhook on save   │  │
│  │                     │   │                              │  │
│  │  POST /webhooks/    │   │  PUT /settings               │  │
│  │    telegram/:id     │   │    → validate token          │  │
│  │  POST /webhooks/    │   │    → save token              │  │
│  │    max/:id          │   │    → register webhook (NEW)  │  │
│  └────────┬────────────┘   └──────────────────────────────┘  │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  WebhookService     │                                     │
│  │  (NEW)              │                                     │
│  │                     │                                     │
│  │  • processUpdate()  │                                     │
│  │  • linkClient()     │                                     │
│  │  • registerHook()   │                                     │
│  │  • verifySecret()   │                                     │
│  └────────┬────────────┘                                     │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────┐   ┌──────────────────────────────┐  │
│  │  EncryptionService  │   │  TelegramProvider (existing) │  │
│  │  (existing)         │   │  + setWebhook()              │  │
│  │  • encrypt(chatId)  │   │  + sendConfirmation()        │  │
│  └─────────────────────┘   └──────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ReviewRequestService (existing)                         ││
│  │  + includeDeepLink() in message templates                ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  (clients    │
                   │   table —    │
                   │   existing)  │
                   └──────────────┘
```

## New Files

| File | Purpose |
|------|---------|
| `packages/api/src/modules/webhooks/routes.ts` | Public webhook endpoints |
| `packages/api/src/modules/webhooks/service.ts` | Webhook processing + auto-linking logic |
| `packages/api/src/modules/webhooks/schema.ts` | Zod schemas for webhook payloads |

## Modified Files

| File | Change |
|------|--------|
| `packages/api/src/services/telegram.ts` | Add `setWebhook()` method |
| `packages/api/src/services/max.ts` | Add `subscribe()` method |
| `packages/api/src/modules/settings/service.ts` | Call webhook registration after token save |
| `packages/api/src/modules/sms/service.ts` | Include deep link in SMS when bot configured |
| `packages/api/src/modules/sms/template-service.ts` | Support `{bot_link}` placeholder in templates |
| `packages/api/src/app.ts` | Register webhook routes (public, no auth) |
| `packages/admin/src/pages/Clients.tsx` | Remove manual chat_id inputs, show link status |

## Database Schema

**No schema changes needed.** The existing `clients` table already has:
- `telegram_chat_id_encrypted` (Bytes?)
- `max_chat_id_encrypted` (Bytes?)
- `preferred_channel` (String)

The only addition is a `WEBHOOK_SECRET` environment variable for webhook verification.

## Environment Variables

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `WEBHOOK_SECRET` | HMAC key for webhook token generation | Random 32-byte hex string | Yes (min 64 hex chars) |
| `API_BASE_URL` | Public URL of API for webhook registration | `https://api.reviewhub.ru` | Yes (valid URL) |

Both must be added to `packages/api/src/config/env.ts` (Zod schema) and `.env.example`.

## CORS for Webhook Endpoints

Webhook routes (`/api/webhooks/*`) must bypass the global CORS restriction. The current CORS whitelist only allows `APP_URL` and `PWA_URL`. Telegram and Max servers need to POST to our webhook endpoints.

**Solution:** Register webhook routes with Fastify **before** the global CORS plugin, or configure per-route CORS with `origin: true` for the `/api/webhooks` prefix. This is safe because:
- Webhook endpoints have no cookies/sessions
- Authentication is via secret token header, not origin
- Rate limiting applies independently

## Security Considerations

### Webhook Authentication
- **Telegram:** Uses `secret_token` parameter in `setWebhook` call. Telegram includes it as `X-Telegram-Bot-Api-Secret-Token` header in every webhook request. We generate it as `HMAC-SHA256(adminId, WEBHOOK_SECRET)`.
- **Max:** Validates request using Max's signature mechanism.

### Rate Limiting
- Webhook endpoints: 100 req/min per `adminId` path parameter
- Prevents abuse of public endpoints

### Information Disclosure Prevention
- All webhook responses return 200 regardless of outcome
- No error details in response body
- Invalid adminId/clientId → silent ignore
