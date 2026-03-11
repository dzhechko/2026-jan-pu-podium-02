# Pseudocode: SMS Integration

## SMSC.ru Service
```
FUNCTION sendSms(phone, message):
  1. POST https://smsc.ru/sys/send.php
     params: { login, psw, phones: phone, mes: message, fmt: 3 (JSON) }
  2. Parse response: { id, cnt, ... } on success, { error, error_code } on failure
  3. Return { success, messageId?, error? }
```

## Send Review Requests
```
FUNCTION sendReviewRequests(admin_id, client_ids):
  1. Load admin (for company name)
  2. For each client_id:
     a. Load client, skip if opted_out
     b. Generate unique token (crypto.randomUUID)
     c. Create ReviewRequest (status: PENDING)
     d. Build SMS: "{company} просит оставить отзыв: {pwa_url}/review/{token}\nОтписка: {pwa_url}/optout/{token}"
     e. Decrypt phone, send via SMSC
     f. Update ReviewRequest status, create SmsLog
  3. Return { sent, failed }
```

## Module Structure
```
packages/api/src/services/smsc.ts        — SMSC.ru HTTP API wrapper
packages/api/src/modules/sms/
├── schema.ts    — Zod validation
├── service.ts   — ReviewRequestService
└── routes.ts    — POST/GET /api/review-requests
```
