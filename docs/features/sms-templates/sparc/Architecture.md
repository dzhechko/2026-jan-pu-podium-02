# Architecture: Custom SMS Templates

## New Components
- `SmsTemplateService` — CRUD + message building
- Routes added to existing SMS module

## Integration Points
- `ReviewRequestService.sendReviewRequests()` — use template #0 for initial SMS
- `ReminderService.buildMessage()` — already queries templates #1-4

## DB
SmsTemplate model already exists in Prisma schema. No migration needed.
Unique constraint: (admin_id, reminder_number) — enforced in upsert logic.
