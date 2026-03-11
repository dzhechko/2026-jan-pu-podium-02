# Pseudocode: Cascade Reminders

## Constants

```
REMINDER_DELAYS = {
  1: 2 * 60 * 60 * 1000,        // 2 hours (first reminder)
  2: 22 * 60 * 60 * 1000,       // +22h (24h total from initial)
  3: 2 * 24 * 60 * 60 * 1000,   // +2d (3d total)
  4: 4 * 24 * 60 * 60 * 1000,   // +4d (7d total)
}
MAX_REMINDERS = 4
TERMINAL_STATUSES = ['REVIEWED', 'OPTED_OUT', 'EXPIRED']
CRON_INTERVAL = '*/5 * * * *'   // every 5 minutes
```

## Algorithm: processReminders()

```
FUNCTION processReminders():
  results = { sent: 0, failed: 0, expired: 0 }

  // 1. Query pending reminders
  requests = SELECT * FROM review_requests
    WHERE next_reminder_at <= NOW()
      AND status NOT IN TERMINAL_STATUSES
      AND reminder_count < MAX_REMINDERS

  // 2. Process each request
  FOR EACH request IN requests:
    TRY:
      // 2a. Check expiration
      IF request.expires_at < NOW():
        UPDATE request SET status = 'EXPIRED', next_reminder_at = NULL
        results.expired++
        CONTINUE

      // 2b. Check client opted out
      client = SELECT * FROM clients WHERE id = request.client_id
      IF client.opted_out:
        UPDATE request SET status = 'OPTED_OUT', next_reminder_at = NULL
        CONTINUE

      // 2c. Get admin settings
      admin = SELECT * FROM admins WHERE id = request.admin_id

      // 2d. Decrypt phone
      phone = decrypt(client.phone_encrypted)

      // 2e. Build message
      nextReminderNumber = request.reminder_count + 1
      template = SELECT * FROM sms_templates
        WHERE admin_id = request.admin_id AND reminder_number = nextReminderNumber

      IF template:
        message = interpolate(template.message_template, { company: admin.company_name, link, optout })
      ELSE:
        message = defaultReminderMessage(admin.company_name, link, optout)

      // 2f. Send SMS
      result = smsc.sendSms(phone, message)

      // 2g. Calculate next reminder timing
      IF nextReminderNumber < MAX_REMINDERS:
        nextDelay = REMINDER_DELAYS[nextReminderNumber + 1]
        nextAt = NOW() + nextDelay
      ELSE:
        nextAt = NULL

      // 2h. Update review request
      UPDATE request SET
        reminder_count = nextReminderNumber,
        next_reminder_at = nextAt,
        status = 'REMINDED_' + nextReminderNumber

      // 2i. Log SMS
      INSERT INTO sms_logs (
        review_request_id, phone_masked, message_preview,
        smsc_message_id, status, reminder_number, sent_at
      )

      results.sent++
    CATCH error:
      LOG error
      results.failed++

  RETURN results
```

## Phone Masking

```
FUNCTION maskPhone(phone: string): string
  // +79001234567 → +7900****567
  RETURN phone.slice(0, 5) + '****' + phone.slice(-3)
```

## Default Reminder Message

```
FUNCTION defaultReminderMessage(company, link, optoutLink):
  RETURN "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optoutLink}"
```

## Scheduler Integration

```
FUNCTION startScheduler():
  cron.schedule(CRON_INTERVAL, async () => {
    result = await processReminders()
    LOG "Reminders processed: sent={result.sent}, failed={result.failed}, expired={result.expired}"
  })
```
