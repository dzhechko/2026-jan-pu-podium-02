# Specification: SMS Integration

## API Endpoints

### POST /api/review-requests
- **Auth**: Bearer token required
- **Input**: `{ client_ids: UUID[] }`
- **Output 200**: `{ sent: number, failed: number }`
- **Constraints**: min 1 client_id

### GET /api/review-requests
- **Auth**: Bearer token required
- **Query**: `{ page, limit, status? }`
- **Output 200**: `{ data: ReviewRequest[], meta: { total, page, limit } }`

## ReviewRequest Object
```json
{
  "id": "uuid",
  "client_name": "string",
  "token": "string",
  "status": "PENDING|SMS_SENT|REMINDED_*|REVIEWED|OPTED_OUT|EXPIRED",
  "reminder_count": 0,
  "sms_sent_at": "ISO 8601 | null",
  "expires_at": "ISO 8601",
  "created_at": "ISO 8601"
}
```

## SMS Message Format
```
{company_name} просит оставить отзыв: {pwa_url}/review/{token}
Отписка: {pwa_url}/optout/{token}
```

## SMSC.ru API Contract
- Endpoint: `https://smsc.ru/sys/send.php`
- Params: login, psw, phones, mes, fmt=3, charset=utf-8
- Success: `{ id, cnt }`
- Error: `{ error, error_code }`

## Business Rules
- Opted-out clients are skipped (increment failed counter)
- Each request gets unique token (UUID without dashes)
- Request expires in 30 days
- After SMS sent: next_reminder_at = now + 2 hours
