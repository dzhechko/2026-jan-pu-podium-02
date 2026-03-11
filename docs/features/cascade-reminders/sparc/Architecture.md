# Architecture: Cascade Reminders

## Component: ReminderService

New service at `packages/api/src/services/reminder.ts`.

```
┌──────────────────────────────────────────┐
│            ReminderService               │
│                                          │
│  ┌─────────┐    ┌─────────┐             │
│  │ node-   │───▶│ process │──▶ SmscService
│  │ cron    │    │Reminders│──▶ Prisma (DB)
│  │ */5min  │    │         │──▶ EncryptionService
│  └─────────┘    └─────────┘             │
└──────────────────────────────────────────┘
```

## Dependencies
- PrismaClient — DB queries
- SmscService — SMS sending
- EncryptionService — phone decryption
- node-cron — scheduling (already installed)

## DB Changes
None. Schema already has all required fields:
- `review_requests.reminder_count`
- `review_requests.next_reminder_at`
- `sms_logs.reminder_number`
- `sms_templates` table

## Integration Point
`packages/api/src/app.ts` — instantiate and start scheduler after Fastify boots.

## Status State Machine

```
PENDING → SMS_SENT → REMINDED_1 → REMINDED_2 → REMINDED_3 → REMINDED_4
                ↓          ↓           ↓           ↓           ↓
           REVIEWED / OPTED_OUT / EXPIRED (terminal states)
```
