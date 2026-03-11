# Refinement: Cascade Reminders

## Edge Cases

1. **Double-send prevention:** Cron runs every 5 min. Two processes could pick the same request. Mitigation: single instance (MVP), transaction isolation for queries.
2. **SMSC failure:** If SMS fails, do NOT advance reminder_count. Leave nextReminderAt unchanged so next cron run retries.
3. **Client deleted mid-cascade:** ON DELETE CASCADE removes review_requests, so no orphan reminders.
4. **Timezone:** All timestamps in UTC (Prisma Timestamptz). Display in admin panel converts to MSK.
5. **Batch size:** Process max 50 reminders per cron tick to avoid overloading SMSC (50/batch limit).

## Security
- Phone decrypted in memory only, never logged or persisted unencrypted
- Opt-out link mandatory in every SMS (152-ФЗ)
- Rate limiting on SMSC.ru side (100 SMS/min)

## Testing Strategy
- Unit: processReminders with mocked Prisma, SMSC, encryption
- Unit: timing calculations (delays, next reminder at)
- Unit: expiration handling
- Unit: opt-out and review cancellation (already tested)
- Integration: full cron cycle with test DB

## Performance
- Query uses index `idx_rr_next_reminder` (already in schema)
- Batch processing: 50 per tick
- Cron interval: 5 min (acceptable latency for reminders)
