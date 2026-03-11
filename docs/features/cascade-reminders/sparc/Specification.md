# Specification: Cascade Reminders

## API Contracts

### No new API endpoints required
Reminders are processed by an internal cron scheduler, not via API.

### Internal Service Interface

```typescript
interface ReminderService {
  processReminders(): Promise<{ sent: number; failed: number; expired: number }>;
  startScheduler(): void;
  stopScheduler(): void;
}
```

## Acceptance Criteria

### AC-1: Reminder Timing
- GIVEN a review request with status SMS_SENT and no review
- WHEN 2 hours pass → reminder #1 sent
- WHEN 24 hours from initial → reminder #2 sent
- WHEN 3 days from initial → reminder #3 sent
- WHEN 7 days from initial → reminder #4 sent (final)

### AC-2: Cancellation on Review
- GIVEN pending reminders exist
- WHEN client submits review → nextReminderAt = null
- THEN no more SMS sent

### AC-3: Cancellation on Opt-Out
- GIVEN pending reminders exist
- WHEN client opts out → nextReminderAt = null, status = OPTED_OUT
- THEN no more SMS sent

### AC-4: Expiration
- GIVEN review request with expires_at in the past
- WHEN cron processes it → status = EXPIRED, nextReminderAt = null

### AC-5: Max 4 Reminders
- GIVEN reminder_count = 4
- THEN no more reminders scheduled (nextReminderAt = null)

### AC-6: Opt-out Link
- Every reminder SMS includes opt-out URL

### AC-7: SMS Logging
- Each reminder creates an SmsLog entry with correct reminder_number

## BDD Scenarios

```gherkin
Feature: Cascade Reminders

  Scenario: Full cascade without review
    Given client received initial SMS at T+0
    When no review is submitted
    Then reminder 1 is sent at T+2h
    And reminder 2 is sent at T+24h
    And reminder 3 is sent at T+3d
    And reminder 4 is sent at T+7d
    And no more reminders after reminder 4

  Scenario: Review cancels remaining reminders
    Given client received reminder 1
    When client submits a review
    Then reminders 2, 3, 4 are cancelled

  Scenario: Opt-out cancels reminders
    Given client clicks opt-out link
    Then all pending reminders are cancelled
    And client.optedOut = true

  Scenario: Expired request
    Given review request expires_at has passed
    When cron runs
    Then status = EXPIRED and no SMS sent
```
