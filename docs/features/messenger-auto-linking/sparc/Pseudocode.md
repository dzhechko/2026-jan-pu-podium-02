# Pseudocode: Messenger Auto-Linking

## Data Structures

### WebhookUpdate (Telegram)
```typescript
interface TelegramWebhookUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;        // This is the chat_id for private messages
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;        // Same as from.id for private chats
      type: 'private' | 'group' | 'supergroup';
    };
    text?: string;
    date: number;
  };
}
```

### WebhookUpdate (Max)
```typescript
interface MaxWebhookUpdate {
  update_type: string;
  timestamp: number;
  message?: {
    sender: {
      user_id: number;
    };
    body: {
      text: string;
    };
    recipient: {
      chat_id: number;
    };
  };
}
```

## Core Algorithms

### Algorithm: Process Telegram Webhook

```
INPUT: request (headers + body), adminId (from URL)
OUTPUT: HTTP 200 (always, to prevent Telegram retries)

STEPS:
1. VALIDATE adminId is UUID format
   IF invalid → RETURN 200 (silent, no retry)

2. VALIDATE secret token header
   secretToken = request.headers['x-telegram-bot-api-secret-token']
   expectedToken = HMAC-SHA256(adminId, WEBHOOK_SECRET)
   IF secretToken !== expectedToken → RETURN 200 (silent)

3. PARSE body as TelegramWebhookUpdate
   IF parse fails → RETURN 200

4. EXTRACT message from update
   IF no message OR message.chat.type !== 'private' → RETURN 200

5. EXTRACT start parameter
   text = message.text
   IF text does NOT start with '/start ' →
     RETURN 200 (acknowledge, no linking action)

   clientId = text.substring(7).trim()
   IF clientId is not valid UUID → RETURN 200

6. RESPOND 200 immediately (async processing below)

7. ASYNC: Link client
   chatId = String(message.from.id)
   CALL linkClientMessenger(adminId, clientId, 'telegram', chatId)

8. ASYNC: Send confirmation
   CALL sendConfirmation(adminId, 'telegram', chatId)
```

### Algorithm: Link Client Messenger

```
INPUT: adminId, clientId, channel ('telegram' | 'max'), chatId
OUTPUT: boolean (success)

STEPS:
1. FIND client WHERE id = clientId AND adminId = adminId
   IF not found → RETURN false

2. IF client.optedOut → RETURN false

3. encryptedChatId = encrypt(chatId)

4. UPDATE client:
   IF channel === 'telegram':
     SET telegramChatIdEncrypted = encryptedChatId
     SET preferredChannel = 'telegram'
   ELSE IF channel === 'max':
     SET maxChatIdEncrypted = encryptedChatId
     SET preferredChannel = 'max'

5. LOG info: "Client {clientId} linked to {channel}, chatId: {masked}"

6. RETURN true
```

### Algorithm: Register Webhook

```
INPUT: adminId, channel ('telegram' | 'max'), botToken
OUTPUT: { success: boolean, error?: string }

STEPS:
1. BUILD webhook URL:
   webhookUrl = "{API_BASE_URL}/api/webhooks/{channel}/{adminId}"

2. GENERATE secret token:
   secretToken = HMAC-SHA256(adminId, WEBHOOK_SECRET)

3. IF channel === 'telegram':
   CALL Telegram API: POST /setWebhook
     url: webhookUrl
     secret_token: secretToken
     allowed_updates: ["message"]

   IF response.ok → RETURN { success: true }
   ELSE → RETURN { success: false, error: response.description }

4. IF channel === 'max':
   CALL Max API: POST /subscriptions
     url: webhookUrl
     update_types: ["message_created"]

   IF success → RETURN { success: true }
   ELSE → RETURN { success: false, error }
```

### Algorithm: Include Deep Link in SMS

```
INPUT: adminId, client, messageTemplate
OUTPUT: messageWithDeepLink

STEPS:
1. FIND admin WHERE id = adminId
   botUsername = admin.telegramBotUsername
   botConfigured = botUsername != null

2. clientLinked = client.telegramChatIdEncrypted != null

3. IF botConfigured AND NOT clientLinked:
   deepLink = "t.me/{botUsername}?start={client.id}"
   appendText = "\n\nПодключите Telegram: {deepLink}"
   RETURN messageTemplate + appendText

4. RETURN messageTemplate (unchanged)
```

## API Contracts

### POST /api/webhooks/telegram/:adminId
**Public endpoint — no auth required**

Request:
```
Headers:
  X-Telegram-Bot-Api-Secret-Token: string
  Content-Type: application/json

Body: TelegramWebhookUpdate (from Telegram servers)
```

Response (always 200):
```json
{ "ok": true }
```

### POST /api/webhooks/max/:adminId
**Public endpoint — no auth required**

Request:
```
Headers:
  Content-Type: application/json

Body: MaxWebhookUpdate (from Max servers)
```

Response (always 200):
```json
{ "ok": true }
```

### GET /api/clients/:id/bot-link (authenticated)
Response:
```json
{
  "telegram": {
    "configured": true,
    "linked": false,
    "deepLink": "https://t.me/review_bot?start=abc-123"
  },
  "max": {
    "configured": true,
    "linked": true,
    "deepLink": null
  }
}
```

## State Transitions

```
Client Messenger State:
  NOT_CONFIGURED → (admin saves bot token) → BOT_READY
  BOT_READY → (deep link sent in SMS) → LINK_PENDING
  LINK_PENDING → (client taps /start) → LINKED
  LINKED → (client re-links) → LINKED (idempotent)

  # Backward edges (token removal):
  BOT_READY → (admin removes token) → NOT_CONFIGURED
  LINK_PENDING → (admin removes token) → NOT_CONFIGURED (deep link becomes dead)
  LINKED → (admin removes token) → LINKED_ORPHANED
    → next send attempt fails → fallback to SMS automatically (existing gateway behavior)

  # Token rotation:
  LINKED → (admin changes token) → LINKED
    → old webhook deregistered, new webhook registered
    → chat_id remains valid (it's user-specific, not token-specific)
```

### Algorithm: Process Max Webhook

```
INPUT: request (headers + body), adminId (from URL)
OUTPUT: HTTP 200 (always)

STEPS:
1. VALIDATE adminId is UUID format
   IF invalid → RETURN 200

2. PARSE body as MaxWebhookUpdate
   IF parse fails → RETURN 200

3. CHECK update_type === 'message_created'
   IF not → RETURN 200

4. EXTRACT message from update
   IF no message → RETURN 200

5. EXTRACT start parameter from message text
   text = message.body.text
   IF text does NOT start with '/start ' → RETURN 200
   clientId = text.substring(7).trim()
   IF clientId is not valid UUID → RETURN 200

6. RESPOND 200 immediately

7. ASYNC: Link client
   chatId = String(message.recipient.chat_id)
   CALL linkClientMessenger(adminId, clientId, 'max', chatId)

8. ASYNC: Send confirmation
   CALL sendConfirmation(adminId, 'max', chatId)
```

Note: Max Bot API does not have a built-in secret_token mechanism like Telegram.
Security relies on: obscure adminId UUID in URL + rate limiting + input validation.
Consider adding IP allowlist if Max publishes webhook source IPs.

### Algorithm: Send Confirmation Message

```
INPUT: adminId, channel ('telegram' | 'max'), chatId
OUTPUT: void (fire and forget)

STEPS:
1. FIND admin WHERE id = adminId
   IF not found → LOG warning, RETURN

2. IF channel === 'telegram' AND admin.telegramBotTokenEncrypted:
   token = decrypt(admin.telegramBotTokenEncrypted)
   provider = new TelegramProvider(token)
   CALL provider.send(chatId, "Вы подключены! Теперь уведомления будут приходить сюда.")
   IF failed → LOG warning (non-critical)

3. IF channel === 'max' AND admin.maxBotTokenEncrypted:
   token = decrypt(admin.maxBotTokenEncrypted)
   provider = new MaxProvider(token)
   CALL provider.send(chatId, "Вы подключены! Теперь уведомления будут приходить сюда.")
   IF failed → LOG warning (non-critical)
```

### Algorithm: Settings Save — Webhook Registration Trigger

```
INPUT: adminId, newTokenEncrypted, oldTokenEncrypted, channel
OUTPUT: { webhookRegistered: boolean, botUsername?: string }

STEPS:
1. IF newTokenEncrypted === oldTokenEncrypted → RETURN (no change)

2. IF oldTokenEncrypted exists (token changed/removed):
   CALL deregisterWebhook(adminId, channel, oldTokenEncrypted)

3. IF newTokenEncrypted is null (token removed):
   RETURN { webhookRegistered: false }

4. token = decrypt(newTokenEncrypted)

5. result = CALL registerWebhook(adminId, channel, token)

6. IF channel === 'telegram':
   provider = new TelegramProvider(token)
   botInfo = CALL provider.getBotInfo()
   IF botInfo → UPDATE admin SET telegramBotUsername = botInfo.username

7. RETURN { webhookRegistered: result.success, botUsername: botInfo?.username }
```

### Algorithm: Deregister Webhook

```
INPUT: adminId, channel, tokenEncrypted
OUTPUT: void

STEPS:
1. token = decrypt(tokenEncrypted)

2. IF channel === 'telegram':
   provider = new TelegramProvider(token)
   CALL fetch("{baseUrl}/deleteWebhook")
   LOG result

3. IF channel === 'max':
   CALL Max API: DELETE /subscriptions
   LOG result

4. Failures are logged but not thrown (non-critical cleanup)
```

## Error Handling Strategy

| Error | Handling | Rationale |
|-------|----------|-----------|
| Invalid adminId in webhook URL | Return 200, log warning | Prevent enumeration |
| Invalid secret token | Return 200, log warning | Security: don't reveal validation |
| Client not found for deep link param | Return 200, ignore | Client may have been deleted |
| Encryption failure | Return 200, log error | Don't block webhook pipeline |
| Webhook registration fails | Save token anyway, warn admin | Token is still valid for manual use |
| Telegram API timeout on setWebhook | Retry on next settings save | Non-critical, will be retried |
