# Specification: Multi-Channel Messaging

## API Contracts

### Channel Configuration

#### PUT /api/settings (extended)
Extends existing settings endpoint with channel credentials.

**Request body (additional fields):**
```json
{
  "telegram_bot_token": "123456:ABC-DEF...",
  "max_bot_token": "abcdef123456..."
}
```

**Response:** Same as current settings response + channel status:
```json
{
  "channels": {
    "sms": { "enabled": true, "status": "configured" },
    "telegram": { "enabled": true, "status": "configured", "bot_username": "@MyReviewBot" },
    "max": { "enabled": false, "status": "not_configured" }
  }
}
```

#### GET /api/settings/channels
Returns enabled channels for current admin.

**Response:**
```json
{
  "channels": [
    { "type": "sms", "configured": true },
    { "type": "telegram", "configured": true, "bot_username": "@MyReviewBot" },
    { "type": "max", "configured": false }
  ]
}
```

### Client Management (extended)

#### POST /api/clients (extended)
**Additional fields:**
```json
{
  "name": "Дмитрий",
  "phone": "+79857677293",
  "telegram_chat_id": "123456789",
  "max_chat_id": "987654321",
  "preferred_channel": "telegram"
}
```

#### CSV Import (extended columns)
```csv
name,phone,email,telegram_chat_id,max_chat_id,preferred_channel
Дмитрий,+79857677293,,123456789,,telegram
Анна,+79161234567,,,654321,max
Иван,+79031112233,,,,sms
```

### Review Requests (extended)

#### POST /api/review-requests (extended)
**Request:**
```json
{
  "client_ids": ["uuid1", "uuid2"],
  "channel": "telegram"
}
```

`channel` is optional. If omitted, uses each client's `preferred_channel` (default: `sms`).

**Response (unchanged format):**
```json
{
  "sent": 2,
  "failed": 0
}
```

### Message Templates (extended)

#### PUT /api/sms-templates (extended)
**Request:**
```json
{
  "reminder_number": 0,
  "channel": "telegram",
  "message_template": "Здравствуйте! {company} просит оставить отзыв:\n🔗 {link}\n\n_Отписка: {optout}_"
}
```

#### GET /api/sms-templates
**Response:** Now grouped by channel:
```json
[
  { "id": "uuid", "reminder_number": 0, "channel": "sms", "message_template": "..." },
  { "id": "uuid", "reminder_number": 0, "channel": "telegram", "message_template": "..." }
]
```

## Validation Rules

| Field | Rule |
|-------|------|
| `telegram_bot_token` | String, format `\d+:[A-Za-z0-9_-]+`, validated via Telegram getMe |
| `max_bot_token` | Non-empty string, validated via Max API info endpoint |
| `telegram_chat_id` | Optional string, numeric, stored as string |
| `max_chat_id` | Optional string, stored as string |
| `preferred_channel` | Enum: `sms`, `telegram`, `max`. Default: `sms` |
| `channel` (in request) | Enum: `sms`, `telegram`, `max`. Optional |
| `message_template` | Must contain `{link}` and `{optout}`. Max 4096 chars for Telegram/Max, 160 awareness for SMS |

## Acceptance Criteria

### AC-1: Channel Credential Storage
- Bot tokens encrypted with AES-256-GCM (same as phone encryption)
- Tokens never logged, never returned in API responses (only masked)
- Validation call made before saving

### AC-2: Message Delivery
- Telegram: uses `sendMessage` via Bot API (`https://api.telegram.org/bot{token}/sendMessage`)
- Max: uses `sendMessageToChat` via Max Bot API (`https://botapi.max.ru/messages`)
- Timeout: 10 seconds per provider call
- On failure: log error, mark as FAILED, fallback to SMS if available

### AC-3: Fallback Chain
- If preferred channel fails → try SMS as fallback
- If SMS also fails → mark as FAILED, retry on next reminder cycle
- Never try more than 2 channels per send attempt

### AC-4: Cascade Reminders
- `ReviewRequest.channel` stores the channel used for initial send
- Reminders use the same channel as initial
- If initial channel becomes unavailable (token revoked), fall back to SMS

### AC-5: Template Isolation
- Templates are unique per (adminId, reminderNumber, channel)
- Default templates exist for each channel
- SMS defaults: plain text
- Telegram/Max defaults: Markdown with emoji

### AC-6: Channel Selection UI (US-MC-007)
- Clients page shows channel selector dropdown (SMS / Telegram / Max)
- Only channels with configured credentials appear in selector
- Bulk send applies selected channel to all selected clients
- Individual "send" button uses client's `preferred_channel` by default
- If client lacks recipient ID for selected channel (e.g., no telegramChatId), show warning and fall back to SMS

### AC-7: Opt-Out via Messenger Channels (152-ФЗ Compliance)
- Opt-out link (`{optout}`) in every message across ALL channels (SMS, Telegram, Max)
- Opt-out link points to PWA page `/optout/{token}` — same flow regardless of channel
- Customer clicks link in messenger → opens PWA in browser → confirms opt-out
- After opt-out: `client.optedOut = true`, all channels stop sending (not just the channel used)
- Opt-out works independently of channel — clicking opt-out from Telegram also stops SMS reminders
- No messenger-specific opt-out mechanism needed — web-based opt-out is channel-agnostic

### AC-8: Telegram Bot /start Prerequisite
- Telegram Bot API requires user to `/start` the bot before bot can send messages
- Admin must instruct clients to start the bot (via QR code, link, or in-person)
- Bot `/start` command handler stores `chat_id` → admin can link it to client record
- If bot tries to send to a user who hasn't `/start`-ed → 403 error → fallback to SMS
- Settings page shows Telegram bot link (`t.me/{bot_username}`) for sharing with clients
- Future: webhook endpoint to auto-capture `/start` events and link to clients

### AC-9: Fallback Template Re-fetch
- When messenger delivery fails and system falls back to SMS, it MUST re-fetch the SMS-specific template
- Never send a messenger-formatted message (with Markdown, emoji) via SMS
- Fallback logic: gateway notifies caller of fallback → caller re-fetches SMS template → sends via SMS provider
