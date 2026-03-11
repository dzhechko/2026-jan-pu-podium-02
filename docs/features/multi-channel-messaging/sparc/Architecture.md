# Architecture: Multi-Channel Messaging

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Admin Panel                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Clients  │ │ Settings │ │ Message Templates    │ │
│  │ +channel │ │ +tokens  │ │ +per channel tabs    │ │
│  └─────┬────┘ └────┬─────┘ └──────────┬───────────┘ │
└────────┼───────────┼──────────────────┼─────────────┘
         │           │                  │
    ─────┼───────────┼──────────────────┼──── /api/* ──
         │           │                  │
┌────────┼───────────┼──────────────────┼─────────────┐
│        ▼           ▼                  ▼      API    │
│  ┌─────────────────────────────────────────────┐    │
│  │           ReviewRequestService              │    │
│  │  sendReviewRequests(adminId, clientIds,      │    │
│  │                     channel?)                │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │                               │
│           ┌─────────▼──────────┐                    │
│           │  MessageGateway    │                     │
│           │  (strategy pattern)│                     │
│           └──┬──────┬──────┬──┘                     │
│              │      │      │                        │
│         ┌────▼┐ ┌───▼───┐ ┌▼─────┐                 │
│         │SMSC │ │Telegram│ │ Max  │                 │
│         │Prov.│ │Provider│ │Prov. │                 │
│         └──┬──┘ └───┬───┘ └──┬───┘                 │
│            │        │        │                      │
│    ┌───────▼────────▼────────▼──────┐               │
│    │         MessageLog             │               │
│    │  (channel, status, externalId) │               │
│    └────────────────────────────────┘               │
│                                                     │
│  ┌──────────────────────────────────┐               │
│  │       ReminderService            │               │
│  │  uses MessageGateway for sends   │               │
│  └──────────────────────────────────┘               │
└─────────────────────────────────────────────────────┘
```

## Database Schema Changes

### New/Modified Models

```prisma
// New enum for channels
// (Prisma doesn't support native enums well in all DBs, use string field)

model Admin {
  // ... existing fields ...

  // NEW: encrypted bot tokens
  telegramBotTokenEncrypted  Bytes?   @map("telegram_bot_token_encrypted")
  telegramBotUsername         String?  @map("telegram_bot_username")
  maxBotTokenEncrypted       Bytes?   @map("max_bot_token_encrypted")
  maxBotName                 String?  @map("max_bot_name")
}

model Client {
  // ... existing fields ...

  // NEW: messenger identifiers
  telegramChatId    String?  @map("telegram_chat_id")
  maxChatId         String?  @map("max_chat_id")
  preferredChannel  String   @default("sms") @map("preferred_channel")  // sms | telegram | max
}

model ReviewRequest {
  // ... existing fields ...

  // NEW: channel tracking
  channel  String  @default("sms")  // sms | telegram | max — channel used for initial send
}

model SmsLog {
  // Rename conceptually to MessageLog (keep table name for migration simplicity)
  // ... existing fields ...

  // NEW: channel tracking
  channel     String  @default("sms")  // sms | telegram | max
  externalId  String? @map("external_id")  // telegram message_id, max message_id
  // Rename smscMessageId → keep for backward compat, externalId for new channels
}

model SmsTemplate {
  // ... existing fields ...

  // NEW: channel field
  channel  String  @default("sms")  // sms | telegram | max

  // Update unique constraint
  @@unique([adminId, reminderNumber, channel])
}
```

### Migration Strategy
- Add new columns as nullable (non-breaking)
- Add default values for existing records
- No data migration needed — existing records are all SMS

## Service Architecture

### MessageProvider Interface

```typescript
interface MessageResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

interface MessageProvider {
  readonly channel: string;  // 'sms' | 'telegram' | 'max'
  send(recipient: string, message: string): Promise<MessageResult>;
  validateCredentials(): Promise<boolean>;
}
```

### Provider Implementations

| Provider | Recipient Field | API Endpoint | Auth |
|----------|----------------|--------------|------|
| SmscProvider | phone number | `https://smsc.ru/sys/send.php` | login + password |
| TelegramProvider | chat_id | `https://api.telegram.org/bot{token}/sendMessage` | bot token in URL |
| MaxProvider | chat_id | `https://botapi.max.ru/messages` | `access_token` query param |

### MessageGateway (Strategy + Fallback)

```typescript
class MessageGateway {
  private providers: Map<string, MessageProvider>;

  async send(channel: string, recipient: string, message: string): Promise<MessageResult> {
    const provider = this.providers.get(channel);
    if (!provider) return { success: false, error: `Channel ${channel} not configured` };

    const result = await provider.send(recipient, message);

    // Fallback to SMS if messenger fails
    if (!result.success && channel !== 'sms') {
      const smsProvider = this.providers.get('sms');
      if (smsProvider) {
        return smsProvider.send(recipient, message);
      }
    }

    return result;
  }
}
```

## File Structure (New/Modified)

```
packages/api/src/
├── services/
│   ├── smsc.ts                    # MODIFIED: implements MessageProvider
│   ├── telegram.ts                # NEW: TelegramProvider
│   ├── max.ts                     # NEW: MaxProvider
│   ├── message-gateway.ts         # NEW: MessageGateway (strategy + fallback)
│   ├── reminder.ts                # MODIFIED: uses MessageGateway
│   └── encryption.ts              # unchanged
├── modules/
│   ├── sms/
│   │   ├── service.ts             # MODIFIED: accepts channel param
│   │   ├── routes.ts              # MODIFIED: channel in request
│   │   ├── schema.ts              # MODIFIED: channel validation
│   │   └── template-service.ts    # MODIFIED: channel-aware templates
│   ├── settings/
│   │   ├── service.ts             # MODIFIED: save/validate bot tokens
│   │   ├── routes.ts              # MODIFIED: channels endpoint
│   │   └── schema.ts              # MODIFIED: token validation schemas
│   └── clients/
│       ├── service.ts             # MODIFIED: telegramChatId, maxChatId, preferredChannel
│       └── schema.ts              # MODIFIED: new fields validation
├── app.ts                         # MODIFIED: initialize providers + gateway
└── config/env.ts                  # unchanged (tokens in DB, not env)

packages/admin/src/
├── pages/
│   ├── Clients.tsx                # MODIFIED: channel column, channel selector
│   └── Settings.tsx               # MODIFIED: bot token fields, channel status
└── lib/
    └── api.ts                     # MODIFIED: new API calls

packages/api/prisma/
└── schema.prisma                  # MODIFIED: new fields
```

## Security Considerations

- Bot tokens encrypted at rest (AES-256-GCM), same as phone numbers
- Tokens never logged, never returned in API (only masked or boolean `configured`)
- Telegram/Max API calls use HTTPS
- Rate limits: Telegram 30 msg/sec, Max 30 req/sec — batch accordingly
- No new public endpoints — channels are admin-only configuration
